#!/bin/sh
OUTPUT=$1
cd /usr/pleak/pleak-leaks-when-analysis/src
ocamlbuild -use-ocamlfind GrbDriver.native
rc=$?; if [[ $rc != 0 ]]; then exit $rc; fi
./GrbDriver.native $OUTPUT
