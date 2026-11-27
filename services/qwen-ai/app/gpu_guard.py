"""Conservative process guard, accounting for WDDM's desktop process reporting."""
import csv
import ntpath

# WDDM reports these desktop clients in compute-apps with unavailable memory.
# Unknown processes (including python, Ollama and renamed inference servers) block.
WDDM_DESKTOP_CLIENTS = frozenset({
    "crossdeviceresume.exe", "startmenuexperiencehost.exe", "searchhost.exe",
    "textinputhost.exe", "armourycrate.exe", "deskin.exe", "vgtray.exe",
    "cloudflare warp.exe", "mcafee-security.exe", "dwm.exe", "explorer.exe",
    "msedgewebview2.exe", "code.exe", "shellexperiencehost.exe", "shellhost.exe",
    "msedge.exe", "chrome.exe",
})


def competing_processes(output: str, own_pid: int, windows: bool) -> list[int]:
    blocked = []
    for row in csv.reader(output.splitlines()):
        if not row or not row[0].strip().isdigit():
            continue
        pid = int(row[0].strip())
        if pid == own_pid:
            continue
        name = ntpath.basename(row[1].strip()).lower() if len(row) > 1 else ""
        memory = row[2].strip() if len(row) > 2 else ""
        if windows and memory in {"[N/A]", "N/A", "[Not Supported]"} and name in WDDM_DESKTOP_CLIENTS:
            continue
        blocked.append(pid)
    return blocked
