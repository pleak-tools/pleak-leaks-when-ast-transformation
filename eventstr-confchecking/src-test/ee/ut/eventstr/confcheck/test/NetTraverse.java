package ee.ut.eventstr.confcheck.test;

import java.util.ArrayList;
import java.util.List;
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

  public static void BuildRun(PetriNet bp, Node current, ArrayList<String> run, Map<String, Boolean> e) {
    Set<Node> incoming = current.getIncoming().stream().map(y -> y.getSource()).collect(Collectors.toSet());
    Set<Node> outgoing = current.getOutgoing().stream().map(y -> y.getTarget()).collect(Collectors.toSet());
    Integer outgoingSize = current.getOutgoing().size();
    String name = current.getName();
    String id = current.getUniqueIdentifier();

    // Mark as visited
    e.put(id, true);

    if(current instanceof Transition) {
      // Add initial data objects to run
      incoming.stream().forEach(x -> {
        if(x.getUniqueIdentifier().contains("DataObjectReference") && x.getIncoming().size() == 0){
          e.put(x.getUniqueIdentifier(), true);
          run.add(x.getName());
        }
      });

      run.add(name);

      outgoing.stream().forEach(x -> {
          NetTraverse.BuildRun(bp, x, run, e);
      });
    }
    else {
      run.add(name);
      if(outgoingSize > 0) {
        List<Node> notVisitedTransitions =  outgoing.stream().filter(x -> !e.get(x.getUniqueIdentifier()) || outgoingSize == 1).collect(Collectors.toList());

        // We visit only one free transition, others are for other runs
        if(notVisitedTransitions.size() > 0){
          Node n = notVisitedTransitions.get(0);
          Set<Node> notVisitedIncomingN = n.getIncoming().stream().map(y -> y.getSource()).filter(x -> !e.get(x.getUniqueIdentifier()) && x.getIncoming().size() > 0).collect(Collectors.toSet());
          // We wait for all branches to run the transition
          if(notVisitedIncomingN.size() == 0)
            NetTraverse.BuildRun(bp, n, run, e);
        }
      }
    }

    // if(outgoingSize > 1 && current instanceof Transition){
    //   // We don't have to wait for temporary data objects branches,
    //   // only for potential parallel branches
    //   Set<Node> visitedOutgoing = current.getOutgoing().stream().map(y -> y.getTarget())
    //   .filter(y -> {
    //     return e.get(y.getUniqueIdentifier()) || y.getName().contains("DataObjectReference");
    //   }).collect(Collectors.toSet());

    //   if(visitedOutgoing.size() == outgoingSize) {
    //     run.add(name);
    //     incoming.stream().forEach(x -> {
    //       if(!x.getUniqueIdentifier().contains("DataObjectReference") || x.getIncoming().size() == 0)
    //         NetTraverse.BuildRun(bp, x, run, e);
    //     });
    //   }
    // }
    // else{
    //   run.add(name);
    //   incoming.stream().forEach(x -> {
    //     if(!x.getUniqueIdentifier().contains("DataObjectReference") || x.getIncoming().size() == 0)
    //       NetTraverse.BuildRun(bp, x, run, e);
    //   });
    // }
  }
}