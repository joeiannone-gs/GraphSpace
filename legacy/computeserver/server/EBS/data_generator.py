import numpy as np
from server.types.value import TensorType
import tensorflow as tf
from safetensors.tensorflow import save_file
import os
import json
import tensorflow_datasets as tfds
from server.protos import nested_array_store_pb2
from server.services.basic import truncate_array
# from google.protobuf import json_format
from server.services.file_utils.nested_array import convert_from_nested_array, convert_to_nested_array

## 2D random points

def generate_correlated_points(n, correlation=0.7, x_mean=0, x_std=1, y_mean=0, y_std=1, noise_level=0.3):
    """
    Generate n points (x, y) with a specified correlation.
    """
    # Generate x values
    x = np.random.normal(x_mean, x_std, n)
    
    # Generate correlated y values
    y = np.zeros(n)
    for i in range(n):
        # Add correlation component
        y[i] = y_mean + correlation * y_std/x_std * (x[i] - x_mean)
        # Add random noise
        y[i] += np.random.normal(0, y_std * noise_level)
    
    # Combine into points
    points = [[float(x[i]), float(y[i])] for i in range(n)]
    
    return points



def create_2d_points_safetensor(n=1000, correlation=0.7, filename="2d_points"):
   
    # Create the directory path for public tensors
    tensor_dir = "computeserver/server/EBS/public/tensors"
    os.makedirs(tensor_dir, exist_ok=True)
    
    # Create the full path with filename
    full_filename = os.path.join(tensor_dir, filename + ".safetensors")

    points = generate_correlated_points(n, correlation)
    tensor_data = tf.convert_to_tensor(points, dtype=tf.float32)
    
    tensors = {filename : tensor_data}
    
    save_file(tensors, full_filename)
    
    return full_filename




## MNIST


def create_mnist_data():

    tf.compat.v1.disable_eager_execution()


    ds = tfds.load('mnist', split='train', as_supervised=True)
    ds = ds.take(200)

    data: TensorType = []

    for image, label in tfds.as_numpy(ds):
        label_as_array = [1 if i == label else 0 for i in range(10)] # One-hot encode
        image_as_array: TensorType = np.squeeze(image).tolist() 
        data.append([image_as_array, label_as_array])

    
    truncated_data = truncate_array(data)
    
    
    # Convert dict to proto
    nested_arr_store = nested_array_store_pb2.NestedArrayStore() 
    nested_arr_store.map["public-mnist-01"].value.CopyFrom(convert_to_nested_array(data))
    nested_arr_store.map["public-mnist-01"].trunctated_value.CopyFrom(convert_to_nested_array(truncated_data))


    # Ensure directory exists
    os.makedirs('computeserver/server/EBS/public/nested-array', exist_ok=True)
    
    # Write the proto to file
    with open('computeserver/server/EBS/public/nested-array/public-mnist-01.bin', 'wb') as f:
        f.write(nested_arr_store.SerializeToString())




