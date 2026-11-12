"""Create the automatic discount that runs the bundle function (same as the editor's "Create the bundle discount"
button in the Connect to store window). Uses the store you connected in the editor; prints no keys.

    python scripts/create_discount.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "editor"))
import bundles  # noqa: E402

print(bundles.create_discount()["message"])
