import os
import sys

# Allow `from src...` imports when pytest is run from the worker/ directory or elsewhere.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
