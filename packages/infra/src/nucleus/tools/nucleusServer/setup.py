# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from setuptools import setup

with open("README.md", "r") as fh:
    long_description = fh.read()

setup(
    name="Nucleus Server Tools",
    version="1.0",
    py_modules=[
        'nst'
    ],
    install_requires=[
        "boto3",
        "python-dotenv",
        "Click"
    ],
    entry_points='''
        [console_scripts]
        nst=nst_cli:main
    '''
)
