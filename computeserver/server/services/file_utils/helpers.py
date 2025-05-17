import os
from pathlib import Path


# Constants for file paths
BASE_PATH = 'server/EBS'
USER_PATH_TEMPLATE = f'{BASE_PATH}/users/{{user_id}}/{{resource_type}}/{{resource_id}}.{{extension}}'
PUBLIC_PATH_TEMPLATE = f'{BASE_PATH}/public/{{resource_type}}/{{resource_id}}.{{extension}}'


def get_file_path(user_id: str | None, resource_type: str, resource_id: str, 
                 extension: str = 'bin', public: bool = False) -> str:
    """Generate consistent file paths for various resource types"""
    if public:
        return PUBLIC_PATH_TEMPLATE.format(
            resource_type=resource_type,
            resource_id=resource_id,
            extension=extension
        )
    return USER_PATH_TEMPLATE.format(
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        extension=extension
    )


def ensure_directory(file_path: str) -> None:
    """Ensure directory exists for given file path"""
    Path(os.path.dirname(file_path)).mkdir(parents=True, exist_ok=True)

def write_file_with_directory_check(file_path: str, data: bytes) -> None:
    """Write data to file, creating directory if needed"""
    try:
        with open(file_path, 'wb') as f:
            f.write(data)
    except FileNotFoundError:
        ensure_directory(file_path)
        with open(file_path, 'wb') as f:
            f.write(data)

