import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

df = pd.read_csv("./benchmark-results-final.csv")
df.columns = df.columns.str.strip()


def bp4(df):
    fig, axes = plt.subplots(2, 2, figsize=(10, 8))

    df["sched_mem_kb"] = df["sched_mem"] / 1024
    df["greedy_mem_kb"] = df["greedy_mem"] / 1024

    pairs = [
        ("sched", "greedy"),
        ("sched_hours", "greedy_hours"),
        ("sched_time", "greedy_time"),
        ("sched_mem_kb", "greedy_mem_kb"),
    ]

    titles = [
        "Score Difference",
        "Hours Difference",
        "Time Difference",
        "Memory Difference",
    ]

    ylables = [
        "# More Tasks scheduled by CS",
        "# More hours scheduled by CS",
        "# Seconds longer by CS",
        "# KB more used by CS",
    ]

    for ax, (a, b), title, ylable in zip(axes.flat, pairs, titles, ylables):
        diff = df[a] - df[b]
        ax.boxplot(diff)
        ax.set_title(title)
        ax.set_ylabel(ylable)

    plt.tight_layout()
    plt.show()

bp4(df[df["sched"] - df["greedy"] > 0])
