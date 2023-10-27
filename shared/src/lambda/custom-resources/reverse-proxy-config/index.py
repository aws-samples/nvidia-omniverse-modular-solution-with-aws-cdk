import os
import logging
import json

from crhelper import CfnResource

import aws_utils.ssm as ssm
import aws_utils.ec2 as ec2
import config.reverseProxy as config

LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG")
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

helper = CfnResource(
    json_logging=False, log_level="DEBUG", boto_level="CRITICAL"
)


@helper.create
def create(event, context):
    logger.info("Create Event: %s", json.dumps(event, indent=2))

    response = update_config(
        ArtifactsBucketName=event["ResourceProperties"]["ARTIFACTS_BUCKET_NAME"],
        FullDomain=event["ResourceProperties"]["FULL_DOMAIN"],
        RpAutoscalingGroupName=event["ResourceProperties"]["RP_AUTOSCALING_GROUP_NAME"],
        NucleusServerAddress=event["ResourceProperties"]["NUCLEUS_SERVER_ADDRESS"]
    )
    logger.info("Run Command Results: %s", json.dumps(response, indent=2))


@helper.update
def update(event, context):
    logger.info("Update Event: %s", json.dumps(event, indent=2))

    response = update_config(
        ArtifactsBucketName=event["ResourceProperties"]["ARTIFACTS_BUCKET_NAME"],
        FullDomain=event["ResourceProperties"]["FULL_DOMAIN"],
        RpAutoscalingGroupName=event["ResourceProperties"]["RP_AUTOSCALING_GROUP_NAME"],
        NucleusServerAddress=event["ResourceProperties"]["NUCLEUS_SERVER_ADDRESS"]
    )
    logger.info("Run Command Results: %s", json.dumps(response, indent=2))


def update_config(
    *,
    ArtifactsBucketName,
    FullDomain,
    RpAutoscalingGroupName,
    NucleusServerAddress
):
    logger.info(f"Nucleus Hostname: {NucleusServerAddress}")
    # generate config for reverse proxy servers
    commands = []
    try:
        commands = config.get_config(
            ArtifactsBucketName, NucleusServerAddress, FullDomain)
        logger.debug(commands)
    except Exception as e:
        raise Exception(f"Failed to get Reverse Proxy config. {e}")

    # get reverse proxy instance ids
    rp_instances = ec2.get_autoscaling_instance(RpAutoscalingGroupName)
    if rp_instances is None:
        raise Exception(
            f"Failed to get Reverse Proxy instance IDs. {e}")

    logger.info(f"Reverse Proxy Instances: {rp_instances}")

    # run config commands
    response = []
    for i in rp_instances:
        r = ssm.run_commands(
            i, commands, document="AWS-RunShellScript"
        )
        response.append(r)

    return response


@helper.delete
def delete(event, context):
    logger.info("Delete Event: %s", json.dumps(event, indent=2))


def handler(event, context):
    helper(event, context)
