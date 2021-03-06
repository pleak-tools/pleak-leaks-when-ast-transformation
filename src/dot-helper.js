var parse = require('dotparser');

let astToDot = (ast) => {
  let handleAttr = x => {
    if (x.type == 'attr_stmt') {
      dot += `${x.attr_list.map(y => `${y.id}="${y.eq}";`).join('\n')}\n`;
    }
  };
  let handleNode = x => {
    if (x.type == 'node_stmt') {
      dot += `${x.node_id.id} [${x.attr_list.map(y => `${y.id}="${y.eq}"`).join(' ')}];\n`;
    }
  };
  let handleEdge = x => {
    if (x.type == 'edge_stmt') {
      dot += `${x.edge_list[0].id} -> ${x.edge_list[1].id} [${x.attr_list.map(y => `${y.id}="${y.eq}"`).join(' ')}];\n`;
    }
  };
  let handleSubgraph = x => {
    if (x.type == 'subgraph') {
      dot += `subgraph ${x.id} {\n`;
      x.children.forEach(y => {
        handleAttr(y);
        handleNode(y);
        handleEdge(y);
        handleSubgraph(y);
      });
      dot += '}\n';
    }
  };

  var dot = `digraph {
    `;

  ast[0].children.forEach(x => {
    handleAttr(x);
    handleNode(x);
    handleEdge(x);
    handleSubgraph(x);
  });

  dot += '}'
  return dot;
}

module.exports = {
  pruneDot(dot, table) {
    var ast = parse(dot);
    var idsToKeep = [];

    // We take the attribute nodes of the selected table as root nodes for traverse
    // Also we have to traverse subgraphs in subgraphs
    let traverseRootSubgraphFunc = (children) => children.filter(x => {
      if (x.type == 'subgraph') {
        let subgraphLabel = x.children.find(y => y.type == 'attr_stmt' && y.attr_list[0].id == 'label');
        return !!subgraphLabel && subgraphLabel.attr_list[0].eq == table;
      }
      else {
        return false;
      }
    });

    let traverseSubgraphFunc = (children) => children.filter(x => {
      return x.type == 'subgraph';
      // if (x.type == 'subgraph') {
      //   let qwe = x.children.find(y => y.type == 'attr_stmt' && y.attr_list[0].id == 'label');
      //   return !!qwe && qwe.attr_list[0].eq == table;
      // }
      // else {
      //   return false;
      // }
    });

    var rootIds = traverseRootSubgraphFunc(ast[0].children);
    ast[0].children.forEach(x => {
      if (x.type == 'subgraph') {
        let innerRoots = traverseRootSubgraphFunc(x.children);
        rootIds = rootIds.concat(innerRoots);
      }
    });

    if (rootIds.length) {
      let nodeIds = [];
      rootIds.forEach(x => nodeIds = nodeIds.concat(x.children.filter(x => x.type == "node_stmt").map(x => x.node_id.id)));
      idsToKeep = idsToKeep.concat(nodeIds);
      ast[0].children.forEach(x => {
        if (x.type == 'subgraph') {
          idsToKeep.push(x.id);
          let innerGraphs = traverseSubgraphFunc(x.children);
          idsToKeep = idsToKeep.concat(innerGraphs.map(y => y.id));
        }
      });

      var st = nodeIds;

      // Collecting all reachable operations up to the 'Filter'
      while (st.length > 0) {
        let curr = st.pop();

        let iterationFunc = children => children.filter(x => x.type == 'edge_stmt' && x.edge_list[0].id == curr);
        let outgoingEdges = iterationFunc(ast[0].children);//ast[0].children.filter(x => x.type == 'edge_stmt' && x.edge_list[0].id == curr);
        ast[0].children.find(x => {
          if (x.type == 'subgraph' && !outgoingEdges.length) {
            outgoingEdges = iterationFunc(x.children);
          }
          return !!outgoingEdges.length;
        });


        outgoingEdges.forEach(x => {
          if (!idsToKeep.find(y => y == x.edge_list[1].id)) {
            idsToKeep.push(x.edge_list[1].id);
            st.push(x.edge_list[1].id);
          }
          if (!idsToKeep.find(y => y == x.edge_list[0].id)) {
            idsToKeep.push(x.edge_list[0].id);
          }
        });
      }

      // Collecting incoming nodes for collected operations
      let idsToKeepTemp = [];
      idsToKeep.forEach(x => {
        let findEdges = (children1) => {
          children1.forEach(edg => {
            if (edg.type == 'edge_stmt' && x == edg.edge_list[1].id) {
              // Matching incoming node id with node object
              // Also we have to search inside the subgraphs
              let findFunc = (children, key) => children.find(child => {
                if (child.type == 'node_stmt') {
                  return child.node_id.id == key;
                }
                else {
                  return false;
                }
              });

              let nodInput = findFunc(children1, edg.edge_list[0].id);
              let nodPotentialAND = findFunc(children1, edg.edge_list[1].id);
              if (!nodInput) {
                children1.find(child => {
                  if (child.type == 'subgraph') {
                    nodInput = findFunc(child.children, edg.edge_list[0].id);
                  }
                  return !!nodInput;
                });
              }

              let obj = !!nodPotentialAND && nodPotentialAND.attr_list.find(z => z.id == 'label');
              if (!obj || obj.eq != 'AND') {
                if (!idsToKeep.find(z => z == edg.edge_list[0].id) &&
                  !idsToKeepTemp.find(z => z == edg.edge_list[0].id)) {
                  idsToKeepTemp.push(edg.edge_list[0].id);
                }
              }
            }
          });
        };
        findEdges(ast[0].children);
        ast[0].children.forEach(y => {
          if (y.type == 'subgraph')
            findEdges(y.children);
        });
      });

      idsToKeep = idsToKeep.concat(idsToKeepTemp);

      // Pruning
      let pruneList = (children) => {
        let index = children.length - 1;
        let arr = children;
        while (index >= 0) {
          let x = children[index];
          if (x.type == 'node_stmt' && !idsToKeep.find(y => y == x.node_id.id)) {
            arr.splice(index, 1);
          }
          if (x.type == 'edge_stmt' && (!idsToKeep.find(y => y == x.edge_list[0].id) ||
            !idsToKeep.find(y => y == x.edge_list[1].id))) {
            arr.splice(index, 1);
          }
          if (x.type == 'subgraph') {
            let subgraphFilter = children.filter(y => y.type == 'node_stmt').find(y => !!y.attr_list.find(z => z.id == 'label' && z.eq == 'Filter'));

            pruneList(x.children);
            if (!x.children.filter(y => y.type == 'node_stmt').length) {
              // Writing '...' instead of table attributes, otherwise looks too massive
              x.children.push({
                type: 'node_stmt',
                node_id: { id: 'empty_' + x.id, type: 'node_id' },
                attr_list: [
                  { eq: 'box', id: 'shape', type: 'attr' },
                  { eq: 'filled,bold', id: 'sdtyle', type: 'attr' },
                  { eq: 'white', id: 'fillcolor', type: 'attr' },
                  { eq: '...', id: 'label', type: 'attr' }
                ]
              });

              // Add '...' operation to tell there are some intermediate calculations
              // but they are displayed only in full leaks-when report

              // Operation
              let existingOperation = children.filter(y => y.type == 'node_stmt').find(y => !!y.attr_list.find(z => z.id == 'label' && z.eq == '...'));
              if (!existingOperation) {
                existingOperation = {
                  type: 'node_stmt',
                  node_id: { id: 'operation_' + x.id, type: 'node_id' },
                  attr_list: [
                    { eq: 'box', id: 'shape', type: 'attr' },
                    { eq: 'filled,bold', id: 'sdtyle', type: 'attr' },
                    { eq: 'white', id: 'fillcolor', type: 'attr' },
                    { eq: '...', id: 'label', type: 'attr' }
                  ]
                };
                children.push(existingOperation);
              }

              // First edge
              children.push({
                type: 'edge_stmt',
                edge_list: [
                  { id: 'empty_' + x.id, type: 'node_id' },
                  { id: existingOperation.node_id.id, type: 'node_id' }
                ],
                attr_list: [
                  { eq: 'box', id: 'shape', type: 'attr' },
                  { eq: 'filled,bold', id: 'sdtyle', type: 'attr' },
                  { eq: 'white', id: 'fillcolor', type: 'attr' }
                ]
              });

              // Second edge
              children.push({
                type: 'edge_stmt',
                edge_list: [
                  { id: existingOperation.node_id.id, type: 'node_id' },
                  { id: subgraphFilter.node_id.id, type: 'node_id' }
                ],
                attr_list: [
                  { eq: 'box', id: 'shape', type: 'attr' },
                  { eq: 'filled,bold', id: 'sdtyle', type: 'attr' },
                  { eq: 'white', id: 'fillcolor', type: 'attr' }
                ]
              });
            }
          }

          index -= 1;
        }
      };
      pruneList(ast[0].children);
    }

    return astToDot(ast);
  }
}