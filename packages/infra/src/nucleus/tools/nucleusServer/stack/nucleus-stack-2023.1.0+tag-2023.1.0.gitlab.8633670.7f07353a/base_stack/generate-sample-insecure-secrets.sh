#!/bin/bash

set -e 
cd "$(dirname "$0")"

if [ -d secrets ]
then
  echo $1
  if [ "$1" = "-force-add" ]; then 
     echo "Forcing adding new secrets to the existing sample set."
  else
    echo ""
    echo "\`secrets/\` directory is present, refusing to proceed."
    echo ""
    echo "You should delete \`secrets\` directory, and re-run the script."
    echo ""
    echo "If you wish this script to proceed and add missing secrets, re-run" 
    echo "with \`-force-add\` option."
    exit 1
  fi
else
  mkdir secrets
fi

if [ -f secrets/auth_root_of_trust.pem ]; then
  echo "--------------------------------------------------------"
  echo "Skipping generation of  short term token signing keypair" 
  echo "--------------------------------------------------------"
else
  echo "-------------------------------------------"
  echo "Generating short term token signing keypair" 
  echo "-------------------------------------------"
  openssl genrsa 4096 > secrets/auth_root_of_trust.pem
  openssl rsa -pubout < secrets/auth_root_of_trust.pem > secrets/auth_root_of_trust.pub
fi

if [ -f secrets/auth_root_of_trust_lt.pem ]; then
  echo "-----------------------------------------------------"
  echo "Skipping generation of long term token signing keypair" 
  echo "-----------------------------------------------------"
else
  echo "------------------------------------------"
  echo "Generating long term token signing keypair" 
  echo "------------------------------------------"
  openssl genrsa 4096 > secrets/auth_root_of_trust_lt.pem
  openssl rsa -pubout < secrets/auth_root_of_trust_lt.pem > secrets/auth_root_of_trust_lt.pub
fi

if [ -f secrets/svc_reg_token ]; then
  echo "-----------------------------------------------------------"
  echo "Skipping generation of discovery service registration token"
  echo "-----------------------------------------------------------"
else
  echo "-----------------------------------------------"
  echo "Generating discovery service registration token" 
  echo "-----------------------------------------------"
  dd if=/dev/urandom bs=1 count=128 |  xxd -plain -c 256 > svc_reg_token_tmp
  # xxd's output adds a newline - 257th char - to the output. 
  # using DD here to remove it.
  dd if=svc_reg_token_tmp of=secrets/svc_reg_token bs=1 count=256
  rm svc_reg_token_tmp
fi


if [ -f secrets/pwd_salt ]; then
  echo "------------------------------------"
  echo "Skipping generation of password salt"
  echo "------------------------------------"
else
  echo "------------------------"
  echo "Generating password salt"
  echo "------------------------"
  dd if=/dev/urandom bs=1 count=4 |  xxd -plain -c 256 > pwd_salt_tmp
  # xxd's output adds a newline - 9th char - to the output. 
  # using DD here to remove it.
  dd if=pwd_salt_tmp of=secrets/pwd_salt bs=1 count=8
  rm pwd_salt_tmp
fi

if [ -f secrets/lft_salt ]; then
  echo "-------------------------------"
  echo "Skipping generation of LFT salt"
  echo "-------------------------------"
else
  echo "------------------------"
  echo "Generating LFT salt"
  echo "------------------------"
  dd if=/dev/urandom bs=1 count=128 |  xxd -plain -c 256 > lft_salt_tmp
  # xxd's output adds a newline to the output. 
  # using DD here to remove it.
  dd if=lft_salt_tmp of=secrets/lft_salt bs=1 count=256
  rm lft_salt_tmp
fi



