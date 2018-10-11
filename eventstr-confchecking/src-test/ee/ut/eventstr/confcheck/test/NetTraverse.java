package ee.ut.eventstr.confcheck.test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Stack;
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

  public static ArrayList<ArrayList<String>> BuildRun2(Node start, ArrayList<ArrayList<String>> runs) {
    ArrayList<String> currentRun = new ArrayList<String>();
    Stack<Node> s = new Stack<>();
    Stack<Node> xorSplitStack = new Stack<>();
    Map<String, ArrayList<String>> marked = new HashMap<String, ArrayList<String>>();
    Map<String, Stack<Node>> stackImages = new HashMap<String, Stack<Node>>();
    s.add(start);

    while(s.size() > 0) {
      Node current = s.pop();
      Set<Node> incoming = current.getIncoming().stream().map(y -> y.getSource()).collect(Collectors.toSet());
      Set<Node> outgoing = current.getOutgoing().stream().map(y -> y.getTarget()).collect(Collectors.toSet());
      Integer incomingSize = current.getIncoming().size();
      Integer outgoingSize = current.getOutgoing().size();
      String name = current.getName();
      String id = current.getUniqueIdentifier();

      if(current instanceof Transition) {
        // Add initial data objects to run
        for(Integer i = 0; i < incomingSize; i++) {
          Node x = incoming.stream().collect(Collectors.toList()).get(i);
          if(x.getName().contains("DataObjectReference") && x.getIncoming().size() == 0 &&
          !currentRun.contains(x.getName())) {
            currentRun.add(x.getName());
          }
        }
      }

      

      final ArrayList<String> currentRunClone = new ArrayList<String>(currentRun);
      Boolean isPredecessorsInRun = incoming.size() == 0 || 
        incoming.stream().allMatch(x -> currentRunClone.contains(x.getName()));

      if(isPredecessorsInRun) {
        currentRun.add(name);
      }

      if(isPredecessorsInRun || outgoingSize == 1 && incomingSize  > 1 && current instanceof Place) {
        if(outgoingSize > 1 && current instanceof Place) {
          stackImages.put(current.getName(), (Stack<Node>)s.clone());
          xorSplitStack.push(current);

          Node n = outgoing.stream().collect(Collectors.toList()).get(0);
          ArrayList<String> arr = new ArrayList<String>();
          arr.add(n.getName());
          marked.put(name, arr);
          s.push(n);
        }
        else {
          if(!id.contains("EndEvent")) {
            Object[] arr = outgoing.toArray();
            for(Integer i = 0; i < arr.length; i++) {
              Node nodeToAdd = (Node)arr[i];
              if(!nodeToAdd.getName().contains("EndEvent") || outgoingSize == 1) {
                s.push(nodeToAdd);
              }
            }
          }
          else {
            runs.add(currentRun);
            while(xorSplitStack.size() > 0) {
              Node top = xorSplitStack.peek();
              Set<Node> xorOut = top.getOutgoing().stream().map(y -> y.getTarget()).collect(Collectors.toSet());

              if(!xorOut.stream().allMatch(x -> marked.get(top.getName()).contains(x.getName()))) {
                currentRun = new ArrayList<String>(currentRun.subList(0, currentRun.indexOf(top.getName()) + 1));

                Set<Node> unmarked = xorOut.stream().filter(x -> !marked.get(top.getName()).contains(x.getName())).collect(Collectors.toSet());
                Node unmarked0 = unmarked.stream().collect(Collectors.toList()).get(0);
                ((ArrayList<String>)marked.get(top.getName())).add(unmarked0.getName());
                 // not to loose possible parallel tasks
                s = (Stack<Node>)stackImages.get(top.getName()).clone();
                s.push(unmarked0);
                break;
              }
              else {
                marked.put(top.getName(), new ArrayList<String>());
                xorSplitStack.pop();
              }
            }
          }
        }
      }

    }

    return runs;
  }
}