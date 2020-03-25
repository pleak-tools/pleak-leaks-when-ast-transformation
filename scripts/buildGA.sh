#!/bin/sh
SERVERDIR=$1
cd "$1/pleak-leaks-when-analysis/src"
echo "We are at $1, trying to build GrbtoGA here."
wait
ocamlbuild -use-ocamlfind GrbToGA.native
retVal=$?
if [ $retVal -ne 0 ]; then
    echo "Could not build GrbtoGA.native, something is wrong with ast-transformer output"
else
    echo "We have succesfully obtained $1/GrbtoGA.native"
fi
wait
exit $retVal
