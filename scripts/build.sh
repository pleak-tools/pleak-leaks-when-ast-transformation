#!/bin/sh
# opam install ocamlgraph
cd /usr/pleak/pleak-leaks-when-analysis/src
ocamlbuild -use-ocamlfind GrbDriver.native
