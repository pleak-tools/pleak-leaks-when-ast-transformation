#!/bin/sh
SERVERDIR=$1
cd "$1/pleak-leaks-when-analysis/src"
wait
ocamlbuild -use-ocamlfind GrbToGA.native
wait
