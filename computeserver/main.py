from fastapi import FastAPI
import uvicorn
import tensorflow as tf
from fastapi.middleware.cors import CORSMiddleware
from .server.app.routers import connect, data, projects, run


app = FastAPI()
app.include_router(connect.router)
app.include_router(data.router)
app.include_router(projects.router)
app.include_router(run.router)



# POST: to create data.
# GET: to read data.
# PUT: to update data.
# DELETE: to delete data.



tf.keras.mixed_precision.set_global_policy('mixed_float16')
# tf.config.optimizer.set_experimental_options({ 'layout_optimizer': True, 'constant_folding': True, 'loop_optimizations': True, 'function_optimization': True })

print("Num GPUs Available: ", len(tf.config.list_physical_devices('GPU')))



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)




@app.get("/")
async def root():
    return {"message": "Hello World"}



if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8080)


# if __name__ == "__main__":
#     from server.EBS.data_generator import create_mnist_data
#     create_mnist_data()