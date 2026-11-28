from app.gpu_guard import competing_processes
import pytest


@pytest.mark.parametrize("name", ["WindowsTerminal.exe", "Notepad.exe", "SystemSettings.exe", "IGCC.exe", "ApplicationFrameHost.exe", "OpenWith.exe"])
def test_windows_utilities_only_exempt_when_wddm_memory_is_unavailable(name):
    assert competing_processes(f"10, C:\\Windows\\{name}, [N/A]", 99, True) == []
    assert competing_processes(f"10, {name}, 500", 99, True) == [10]
    assert competing_processes(f"10, {name}, [N/A]", 99, False) == [10]


def test_wddm_desktop_clients_do_not_block_but_ai_and_unknown_processes_do():
    text = "1, C:\\Windows\\SearchHost.exe, [N/A]\n2, C:\\Python\\python.exe, [N/A]\n3, unknown.exe, [N/A]\n4, python.exe, 500"
    assert competing_processes(text, own_pid=4, windows=True) == [2, 3]


def test_measured_compute_memory_and_non_windows_processes_remain_blocked():
    assert competing_processes("1, SearchHost.exe, 500", 99, True) == [1]
    assert competing_processes("1, SearchHost.exe, [N/A]", 99, False) == [1]
    assert competing_processes("1, ShellHost.exe, [N/A]\n2, msedge.exe, [N/A]", 99, True) == []
    assert competing_processes("1, msedge.exe, 500", 99, True) == [1]
