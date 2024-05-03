from setuptools import setup

with open("README.md", "r") as fh:
    long_description = fh.read()

setup(
    name="Reverse Proxy Tools",
    version="1.0",
    py_modules=["rpt"],
    install_requires=["boto3", "python-dotenv", "Click"],
    entry_points="""
        [console_scripts]
        rpt=rpt_cli:main
    """,
)
