package ee.ut.eventstr.confcheck.test;

import ee.ut.eventstr.confcheck.test.PetriNode.NodeType;
import hub.top.petrinet.PetriNet;
import hub.top.petrinet.Place;

public class PetriConverter {
  
  public static PetriNet Convert(PetriNode[] nodes) {
    PetriNet net = new PetriNet();

    for(int i = 0; i < nodes.length; i++) {

      // Temporarily, labels instead of ids, smth may break if use labels
      // if(!nodes[i].label.equals("")) {
      //   for(int q = 0; q < nodes.length; q++) {
      //     for(int w = 0; w < nodes[q].out.length; w++) {
      //       if(nodes[q].out[w].equals(nodes[i].id)) {
      //         nodes[q].out[w] = nodes[i].label;
      //       }
      //     }
      //   }

      //   nodes[i].id = nodes[i].label;
      // }

      // We allow multiple outgoing arcs only for intermediate data objects, 
      // but not for 'global' (starting) data objects
      if(nodes[i].id.contains("DataObjectReference") && nodes[i].out.length > 1 && !nodes[i].isInputFound) {
        nodes[i].out = new String[] { new String(nodes[i].out[nodes[i].out.length - 1]) };
      }

      if(nodes[i].type == NodeType.place){
        Place p = net.addPlace(nodes[i].id);
        if(!nodes[i].isInputFound){
          net.setTokens(p, 1);
        }
      }
      else{
        net.addTransition(nodes[i].id);
      }
    }

    for(int i = 0; i < nodes.length; i++) {
      for(int j = 0; j < nodes[i].out.length; j++) {
        net.addArc(nodes[i].id, nodes[i].out[j]);
      }
    }

    return net;
  }
}