"""Graph"""
import asyncio
from computeserver.server.protos.node_pb2 import NodeTypeEnum
import threading

from google.protobuf.internal.containers import MessageMap
from computeserver.server.protos  import graph_pb2, node_pb2, path_pb2
import tensorflow as tf
from queue import Queue


from computeserver.server.services.basic import convert_to_list, topological_sort, get_dependencies, get_descendants
from computeserver.server.nodes.data_flow import SHOULD_RECEIVE_STREAMING_UPDATES, SHOULD_RECEIVE_UPDATES
# from server.types.graph import Graph, NodeIdMap, Path
import computeserver.server.compute.operations as ops
from computeserver.server.services.compute import generate_id
from computeserver.server.types.value import TensorType, TypicalValue, ValueMap


class RunningGraph:

    def __init__(self, graph: graph_pb2.Graph, gradient_path_map: path_pb2.Path, learning_rate: float, values: ValueMap, optimize_interval: float) -> None:
        self.node_id_map: MessageMap[str, node_pb2.Node ]  = graph.nodeIdMap
        self.graph: graph_pb2.Graph = graph
        self.gradient_path_map: path_pb2.Path = gradient_path_map
        self.values: ValueMap = values
        self.optimize_interval: float = optimize_interval
        self.optimizer = tf.keras.optimizers.SGD(learning_rate)

        self.update_queue: Queue[tuple[node_pb2.NodeTypeEnum, str, TypicalValue]] = Queue()

        self.executing_event = threading.Event()
        self.executing_event.clear()  # Initially paused

        def forward_and_optimize():
            # Forward Pass
            self.compute_graph()
            # Start training loop (in a new thread)
            self.optimize_graph()
            self.executing_event.clear()

        self.thread = threading.Thread(target=forward_and_optimize)
        self.thread.start()
        
    
    def start(self):
        self.executing_event.set()
    

    def pause(self):
        self.executing_event.clear()

    def contains_parameter_nodes(self):
        """Checks if the graph contains parameter nodes"""
        return any(node.type == node_pb2.NodeTypeEnum.PARAMETER for node in self.node_id_map.values())


  


    def optimize_graph(self):
        """Optimize each parameter with respect to its loss function (while is_optimizing is true)"""
        if self.gradient_path_map != None and not self.contains_parameter_nodes():
            return

        # Training loop
        print('optimizing...')
        loop_num  =  0
        while True:
            self.executing_event.wait()  # Will block when paused (flag is false (hasnt been cleared yet))
            # await asyncio.sleep(self.optimize_interval)
            for entry, param_node_ids in self.gradient_path_map.map.items():

                param_node_ids = list(param_node_ids.ids)
                predictor_id, loss_id = entry.split('->-')
                
                self.training_step(param_node_ids, predictor_id, loss_id)

                print(f"Training loop: {loop_num}")
                loop_num += 1

                # for node_id in param_node_ids:
                #     param = self.values.get(self.node_id_map[node_id].valuePointer)
                #     node_type = self.node_id_map[node_id].type
                #     new_value = param
                #     self.update_queue.put((node_type, node_id, new_value))



    # @tf.function(jit_compile=True)
    # @tf.function
    def training_step(self, param_node_ids: list[str], predictor_id: str, loss_id: str):
        print("Tracing...")
        parameters= [self.values.get(self.node_id_map[node_id].valuePointer) for node_id in param_node_ids]

        with tf.GradientTape() as tape:
            self.compute_graph(abs_node_id=predictor_id)
            loss = self.compute_graph(abs_node_id=loss_id)

        gradients = tape.gradient(loss, parameters)
        self.optimizer.apply_gradients(zip(gradients, parameters))



    def compute_graph(self, abs_node_id: str | None = None):
        """
        While there are still nodes in top_sorted, continue to compute the next node.
        If an abs_node_id is provided, only compute its descendants.
        """
       
        # Compute graph (compute only descendants of abs node if provided)
        
        top_sort_to_compute = []
        if abs_node_id:
            descendants_of_abs = get_descendants(abs_node_id, self.graph)
            top_sort_to_compute = topological_sort(descendants_of_abs, self.graph)
        else:
            top_sort_to_compute = topological_sort(list(self.node_id_map.keys()), self.graph)
        
        last_node_value = None
        while len(top_sort_to_compute) > 0:
            node_id = top_sort_to_compute.pop(0)
            new_value= self.compute_node(node_id)
            self.update_node_value(node_id, new_value)
            last_node_value = new_value

        return last_node_value



    def compute_node(self, node_id: str):
        """Update own value based on inputs and process, calculate new top_sort to return"""

        node = self.node_id_map[node_id]
        node_type: NodeTypeEnum = node.type
        input_node_ids = get_dependencies(node_id, self.graph)

        # Get value and input values
        node_value = self.values.get(node.valuePointer)
        input_values = [self.values.get(self.node_id_map[id].valuePointer) for id in input_node_ids]
        metadata = node.metadata

        if node_type == node_pb2.NodeTypeEnum.SUBTRACT:
            return ops.subtract(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.ADD: 
            return ops.add(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.MULTIPLY: 
            return ops.multiply(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.VALUE: 
            return ops.value(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.IMPORT:
            return ops.value(node_value, input_values, metadata) 
        elif node_type == node_pb2.NodeTypeEnum.SLICE:
            return ops.slice_op(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.PARAMETER: 
            return ops.parameter(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.SQUARE: 
            return ops.square(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.AVERAGE: 
            return ops.average(node_value, input_values, metadata)
        # elif node_type == node_pb2.NodeTypeEnum.DISPLAY:
        #     return ops.display(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.RELU:
            return ops.relu(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.FLATTEN:
            return ops.flatten(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.ARRAY:
            return ops.array(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.IMAGE:
            return ops.image(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.STACK:
            return ops.stack(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.POP:
            return ops.pop(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.DOT:
            return ops.dot(node_value, input_values, metadata)
        elif node_type == node_pb2.NodeTypeEnum.SIGMOID:
            return ops.sigmoid(node_value, input_values, metadata)
       
        raise ValueError(f"Unknown node type: {node_type}")


    # @tf.py_function(Tout=[])
    def update_node_value(self, node_id: str, new_value: tf.Tensor | TensorType):
        """
        Update the value on the client and server
        """
        node = self.node_id_map[node_id]
        node_type = node.type

        pointer = node.valuePointer or generate_id(16)
        node.valuePointer = pointer
        self.values[pointer] = new_value

        if node_type not in SHOULD_RECEIVE_UPDATES and node_type not in SHOULD_RECEIVE_STREAMING_UPDATES:
            return

        self.update_queue.put((node_type, node_id, new_value))