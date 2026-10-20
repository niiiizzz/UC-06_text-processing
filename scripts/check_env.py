import os

def check_env():
    found = {}
    for k, v in os.environ.items():
        if any(w in k.upper() for w in ["AZURE", "TF_", "SUBSCRIPTION", "LATHE"]):
            found[k] = v[:4] + "..." if len(v) > 4 else v
    print("Found keys:", found)

if __name__ == "__main__":
    check_env()
