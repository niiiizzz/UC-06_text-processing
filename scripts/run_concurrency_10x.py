import subprocess
import sys

def main():
    print("[*] Running 10 consecutive concurrency test iterations for Gate G2...")
    for i in range(1, 11):
        print(f"--- Iteration {i}/10 ---")
        cmd = [sys.executable, "-m", "pytest", "tests/concurrency/test_concurrency.py", "-q", "-W", "ignore"]
        res = subprocess.run(cmd)
        if res.returncode != 0:
            print(f"[!] Iteration {i} failed with exit code {res.returncode}")
            sys.exit(1)
    print("\n[+] SUCCESS: All 10 concurrency iterations passed with 0 failures!")

if __name__ == "__main__":
    main()
