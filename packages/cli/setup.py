from setuptools import setup, find_packages

setup(
    name="mighty-cli",
    version="1.0.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    entry_points={
        "console_scripts": [
            "mighty=mighty.cli:cli",
        ],
    },
    install_requires=[
        "click>=8.0",
        "httpx>=0.24",
        "rich>=13.0",
        "keyring>=24.0",
    ],
    python_requires=">=3.11",
)
