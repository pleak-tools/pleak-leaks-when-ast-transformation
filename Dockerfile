FROM ocaml/opam
RUN opam install ocamlgraph
RUN curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
RUN sudo apt-get install -y nodejs
COPY . /usr/pleak
WORKDIR /usr/pleak
RUN sudo chown opam:opam -R .
RUN sudo mkdir /data
RUN sudo chown opam:opam /data
RUN npm install
CMD ./scripts/build.sh ; nohup node ./server.js