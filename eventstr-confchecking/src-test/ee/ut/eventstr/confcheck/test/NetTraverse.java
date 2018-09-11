package ee.ut.eventstr.confcheck.test;

import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import hub.top.petrinet.Arc;
import hub.top.petrinet.Node;
import hub.top.petrinet.PetriNet;
import hub.top.petrinet.Place;
import hub.top.petrinet.Transition;

public class NetTraverse {

  public static void RemoveResiduals(PetriNet bp, Node current) {
    Set<Node> incoming = current.getIncoming().stream().map(y -> y.getSource()).collect(Collectors.toSet());
    Set<Arc> outgoing = current.getOutgoing();

    if (outgoing.size() == 0) {
      if (current instanceof Place)
        bp.removePlace((Place) current);
      else
        bp.removeTransition((Transition) current);

      incoming.stream().forEach(x -> NetTraverse.RemoveResiduals(bp, x));
    }
  }

  public static void BuildRun(PetriNet bp, Node current, ArrayList<String> run, Map<String, Integer> e) {
    Set<Node> incoming = current.getIncoming().stream().map(y -> y.getSource()).collect(Collectors.toSet());
    Integer outgoing = current.getOutgoing().size();
    String name = current.getName();
    String id = current.getUniqueIdentifier();

    if(outgoing > 1 && current instanceof Transition){
      if(e.get(id) == outgoing - 1){
        e.put(id, outgoing);
        run.add(name);
        incoming.stream().forEach(x -> NetTraverse.BuildRun(bp, x, run, e));
      }
      else {
        e.put(id, e.get(id) + 1);
      }
    }
    else{
      run.add(name);
      incoming.stream().forEach(x -> NetTraverse.BuildRun(bp, x, run, e));
    }
  }
}