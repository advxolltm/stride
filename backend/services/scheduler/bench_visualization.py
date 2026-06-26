import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

df = pd.read_csv("./benchmark-results-final-v2.csv")
df.columns = df.columns.str.strip()


def bp4(df):
    fig, axes = plt.subplots(1, 1, figsize=(10, 8))

    df["sched_mem_kb"] = df["sched_mem"] / 1024
    df["greedy_mem_kb"] = df["greedy_mem"] / 1024

    pairs = [
        # ("sched", "greedy"),
        # ("sched_hours", "greedy_hours"),
        # ("sched_time", "greedy_time"),
        # ("sched_mem_kb", "greedy_mem_kb"),
        ("user_hours_greedy_span", "user_hours_sched_span")
    ]

    titles = [
        # "Score Difference",
        # "Hours Difference",
        # "Time Difference",
        # "Memory Difference",
        "User-Load Difference",
    ]

    ylables = [
        # "# More Tasks scheduled by CS",
        # "# More hours scheduled by CS",
        # "# Seconds longer by CS",
        # "# KB more used by CS",
        "% Difference in User-Load"
    ]

    for (a, b), title, ylable in zip(pairs, titles, ylables):
        diff = df[a] / df[b]
        axes.boxplot(diff)
        axes.set_title(title)
        axes.set_ylabel(ylable)

    plt.tight_layout()
    plt.show()

bp4(df[df["sched"] - df["greedy"] > 0])
