#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Export graph views of the Quran Knowledge Graph for network visualization.

Reads quran-kg.db and writes CSV files into graph/:

  graph/root_nodes.csv          one node per root  (id, label, occurrences)
  graph/root_edges.csv          root <-> root, weighted by shared-ayah count
  graph/root_lemma_nodes.csv    roots + lemmas as a bipartite node list
  graph/root_lemma_edges.csv    root -> lemma derivation edges
  graph/neo4j_import.cypher     ready-to-run Cypher LOAD CSV script

The node/edge CSVs load directly into Gephi, Cytoscape, or pandas/networkx.

Usage:
  python3 export_graph.py [--min-weight N]   (default N=3; filters weak
                                              root-root edges to keep the
                                              co-occurrence graph readable)
"""

import argparse
import csv
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(HERE, "quran-kg.db")
OUT_DIR = os.path.join(HERE, "graph")


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"  wrote {os.path.relpath(path, HERE)} ({len(rows):,} rows)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-weight", type=int, default=3,
                    help="minimum shared-ayah count for root-root edges")
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    db = sqlite3.connect(DB_FILE)

    print("exporting root nodes ...")
    roots = db.execute(
        "SELECT root_id, root_ar, occurrences FROM root ORDER BY root_id").fetchall()
    write_csv(os.path.join(OUT_DIR, "root_nodes.csv"),
              ["id", "label", "occurrences"], roots)

    print("exporting root co-occurrence edges (this is the heavy one) ...")
    edges = db.execute("""
        SELECT s1.root_id, s2.root_id, COUNT(DISTINCT s1.ayah_id) AS weight
        FROM segment s1
        JOIN segment s2 ON s2.ayah_id = s1.ayah_id AND s2.root_id > s1.root_id
        GROUP BY s1.root_id, s2.root_id
        HAVING weight >= ?
        ORDER BY weight DESC""", (args.min_weight,)).fetchall()
    write_csv(os.path.join(OUT_DIR, "root_edges.csv"),
              ["source", "target", "weight"], edges)

    print("exporting root->lemma derivation graph ...")
    nodes = [(f"r{r}", t, "root") for r, t, _ in roots]
    nodes += [(f"l{l}", t, "lemma") for l, t in db.execute(
        "SELECT lemma_id, lemma_ar FROM lemma")]
    write_csv(os.path.join(OUT_DIR, "root_lemma_nodes.csv"),
              ["id", "label", "type"], nodes)
    dedges = db.execute("""
        SELECT 'r' || root_id, 'l' || lemma_id, occurrences
        FROM lemma WHERE root_id IS NOT NULL""").fetchall()
    write_csv(os.path.join(OUT_DIR, "root_lemma_edges.csv"),
              ["source", "target", "weight"], dedges)

    cypher = f"""// Neo4j import for the Quran Knowledge Graph root network.
// Copy the graph/ CSVs into Neo4j's import folder, then run this script.
CREATE CONSTRAINT root_id IF NOT EXISTS FOR (r:Root) REQUIRE r.id IS UNIQUE;
LOAD CSV WITH HEADERS FROM 'file:///root_nodes.csv' AS row
CREATE (:Root {{id: toInteger(row.id), text: row.label,
               occurrences: toInteger(row.occurrences)}});
LOAD CSV WITH HEADERS FROM 'file:///root_edges.csv' AS row
MATCH (a:Root {{id: toInteger(row.source)}}), (b:Root {{id: toInteger(row.target)}})
CREATE (a)-[:CO_OCCURS {{weight: toInteger(row.weight)}}]->(b);
"""
    path = os.path.join(OUT_DIR, "neo4j_import.cypher")
    with open(path, "w", encoding="utf-8") as f:
        f.write(cypher)
    print(f"  wrote {os.path.relpath(path, HERE)}")
    db.close()
    print("done.")


if __name__ == "__main__":
    main()
