# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import logging
import json


from crhelper import CfnResource

import aws_utils.ssm as ssm
import aws_utils.sm as sm
import aws_utils.ec2 as ec2
import config.nucleus as config

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

helper = CfnResource(json_logging=False, log_level="DEBUG",
                     boto_level="CRITICAL")


@helper.create
def create(event, context):
    logger.info("Create Event: %s", json.dumps(event, indent=2))

    response = update_nucleus_config(
        PrimaryInstanceId=event["ResourceProperties"]["primaryInstanceId"],
        StandbyInstanceId=event["ResourceProperties"]["standbyInstanceId"],
        ArtifactsBucket=event["ResourceProperties"]["artifactsBucket"],
        ReverseProxyDomain=event["ResourceProperties"]["reverseProxyDomain"],
        NucleusBuild=event["ResourceProperties"]["nucleusBuild"],
        OvMainLoginSecretArn=event["ResourceProperties"]["ovMainLoginSecretArn"],
        OvServiceLoginSecretArn=event["ResourceProperties"]["ovServiceLoginSecretArn"],
    )
    logger.info("Run Command Results: %s", json.dumps(response, indent=2))


@helper.update
def update(event, context):
    logger.info("Update Event: %s", json.dumps(event, indent=2))

    response = update_nucleus_config(
        PrimaryInstanceId=event["ResourceProperties"]["primaryInstanceId"],
        StandbyInstanceId=event["ResourceProperties"]["standbyInstanceId"],
        ArtifactsBucket=event["ResourceProperties"]["artifactsBucket"],
        ReverseProxyDomain=event["ResourceProperties"]["reverseProxyDomain"],
        NucleusBuild=event["ResourceProperties"]["nucleusBuild"],
        OvMainLoginSecretArn=event["ResourceProperties"]["ovMainLoginSecretArn"],
        OvServiceLoginSecretArn=event["ResourceProperties"]["ovServiceLoginSecretArn"],
    )
    logger.info("Run Command Results: %s", json.dumps(response, indent=2))


def update_nucleus_config(
    *,
    PrimaryInstanceId,
    StandbyInstanceId,
    ArtifactsBucket,
    ReverseProxyDomain,
    NucleusBuild,
    OvMainLoginSecretArn,
    OvServiceLoginSecretArn,
):

    ov_main_login_secret = sm.get_secret(OvMainLoginSecretArn)
    ov_service_login_secret = sm.get_secret(OvServiceLoginSecretArn)
    ov_main_login_password = ov_main_login_secret["password"]
    ov_service_login_password = ov_service_login_secret["password"]

    # generate config for reverse proxy servers
    commands = []
    try:
        commands = config.get_config(
            ArtifactsBucket, ReverseProxyDomain, NucleusBuild, ov_main_login_password, ov_service_login_password)
        logger.debug(commands)
    except Exception as e:
        raise Exception("Failed to get Reverse Proxy config. {}".format(e))

    for p in commands:
        print(p)

    # configure primary instance
    try:
        primary_response = ssm.run_commands(
            PrimaryInstanceId, commands, document="AWS-RunShellScript")
        logger.info(primary_response)
    except Exception as e:
        raise Exception(
            "Failed to configure Primary Nucleus Instance. {}".format(e))

    # configure standby instance
    try:
        standby_response = ssm.run_commands(
            StandbyInstanceId, commands, document="AWS-RunShellScript")
        logger.info(standby_response)
        ec2.stop_instances([StandbyInstanceId])
    except Exception as e:
        raise Exception(
            "Failed to configure Standby Nucleus Instance. {}".format(e))

    return primary_response


@helper.delete
def delete(event, context):
    logger.info("Delete Event: %s", json.dumps(event, indent=2))


def handler(event, context):
    helper(event, context)
