"""Compute services. Routing, getting remaining nodes, conditions..."""
import string
import secrets


def generate_id(length: int) :
    """Generate an alphanumeric ID"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))


