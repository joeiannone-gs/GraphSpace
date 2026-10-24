"""Write the graph datasets used by the Graph Data node (run once; needs networkx and numpy).

    python scripts/make-graph-datasets.py

karate.json: Zachary's karate club (1977): 34 members, 78 friendships, and the faction each member
joined after the club split (Mr. Hi = 0, Officer = 1). Two members are labeled for training.
communities.json: a synthetic social network of three communities (stochastic block model) whose
members have noisy features that only weakly hint at their community.
Both include node positions from a spring layout (fixed seed) for drawing.
"""
import json
import networkx as nx
import numpy as np


def layout(g, seed):
    pos = nx.spring_layout(g, seed=seed, iterations=200)
    xy = np.array([pos[i] for i in range(g.number_of_nodes())])
    xy -= xy.mean(axis=0)
    xy /= np.abs(xy).max()
    return [[round(float(a), 4), round(float(b), 4)] for a, b in xy]


def karate():
    g = nx.karate_club_graph()
    labels = [0 if g.nodes[i]["club"] == "Mr. Hi" else 1 for i in range(g.number_of_nodes())]
    return {
        "name": "Zachary's karate club",
        "n": g.number_of_nodes(),
        "edges": sorted([sorted(e) for e in g.edges()]),
        "classes": ["Mr. Hi", "Officer"],
        "labels": labels,
        "labeled": [0, 33],
        "features": None,
        "pos": layout(g, 7),
    }


def communities(per=20, k=3, p_in=0.25, p_out=0.015, dims=4, signal=0.6, seed=3):
    rng = np.random.default_rng(seed)
    g = nx.stochastic_block_model([per] * k, [[p_in if a == b else p_out for b in range(k)] for a in range(k)], seed=seed)
    labels = [i // per for i in range(per * k)]
    centers = rng.normal(size=(k, dims))
    centers /= np.linalg.norm(centers, axis=1, keepdims=True)
    feats = np.array([signal * centers[c] + rng.normal(size=dims) for c in labels])
    labeled = [c * per + j for c in range(k) for j in (0, 1)]
    return {
        "name": "Three communities",
        "n": per * k,
        "edges": sorted([sorted(e) for e in g.edges()]),
        "classes": ["Community A", "Community B", "Community C"],
        "labels": labels,
        "labeled": labeled,
        "features": [[round(float(v), 4) for v in row] for row in feats],
        "pos": layout(g, 5),
    }


for name, data in [("karate", karate()), ("communities", communities())]:
    with open(f"public/datasets/{name}.json", "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(name, data["n"], "nodes", len(data["edges"]), "edges")
