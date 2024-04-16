#!/bin/sh

# This script destroys leftover resources 
# created by the NVIDIA Omniverse on AWS solution

# empties logs bucket and deletes
LOGS_BUCKET="omninucleus-us-west-2-omniverse-nucleus-logs-bucket"
echo "Emptying and deleting logs bucket: $LOGS_BUCKET"
aws s3 rm --recursive s3://"$LOGS_BUCKET" 
aws s3 rb s3://"$LOGS_BUCKET"

# get keypair ids
OMNI_JUMPBOX_KP_NAME="omni-jumpbox-keypair"
OMNI_WORKSTATION_KP_NAME="omni-workstation-keypair"

JUMPBOX_KP_ID=$(aws ec2 describe-key-pairs --key-names "$OMNI_JUMPBOX_KP_NAME" | jq -r ".KeyPairs[0].KeyPairId")
WORKSTATION_KP_ID=$(aws ec2 describe-key-pairs --key-names "$OMNI_WORKSTATION_KP_NAME" | jq -r ".KeyPairs[0].KeyPairId")

# delete ssm parameters 
echo "Deleting ssm parameters: $OMNI_JUMPBOX_KP_NAME, $OMNI_WORKSTATION_KP_NAME, /ec2/keypair/$JUMPBOX_KP_ID, /ec2/keypair/$WORKSTATION_KP_ID"
aws ssm delete-parameter --name "$OMNI_JUMPBOX_KP_NAME"
aws ssm delete-parameter --name "$OMNI_WORKSTATION_KP_NAME"
aws ssm delete-parameter --name "/ec2/keypair/$JUMPBOX_KP_ID"
aws ssm delete-parameter --name "/ec2/keypair/$WORKSTATION_KP_ID"

# delete ec2 keypairs
echo "Deleting ec2 keypairs: $OMNI_JUMPBOX_KP_NAME, $OMNI_WORKSTATION_KP_NAME"
aws ec2 delete-key-pair --key-name "$OMNI_JUMPBOX_KP_NAME"
aws ec2 delete-key-pair --key-name "$OMNI_WORKSTATION_KP_NAME"