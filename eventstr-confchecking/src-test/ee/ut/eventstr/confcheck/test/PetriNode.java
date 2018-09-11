package ee.ut.eventstr.confcheck.test;

public class PetriNode {
  enum NodeType {
    place, transition
  };

  String id;
  NodeType type;
  String[] out;
  boolean isInputFound = false;
  String label = "";
}