#!/bin/sh
SERVERDIR=$1
OUTPUT=$2
cd "$1/pleak-leaks-when-analysis/src"
wait
#ocamlbuild -use-ocamlfind GrbDriver.native
#rc=$?; if [[ $rc != 0 ]]; then exit $rc; fi
./GrbDriver.native "$1$OUTPUT"
