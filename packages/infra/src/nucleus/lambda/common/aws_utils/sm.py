import json

import boto3

SM = boto3.client("secretsmanager")


def get_secret(secret_name):
    response = SM.get_secret_value(SecretId=secret_name)
    secret = json.loads(response["SecretString"])
    return secret
