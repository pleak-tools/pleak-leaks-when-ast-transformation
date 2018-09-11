package ee.ut.bpmn.utils;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.jdom.Document;
import org.jdom.Element;
import org.jdom.JDOMException;
import org.jdom.Namespace;
import org.jdom.Text;
import org.jdom.input.SAXBuilder;

import ee.ut.bpmn.BPMNProcess;

public class BPMN2Reader {
  public static BPMNProcess<Element> parse(File file) throws JDOMException, IOException {
    Namespace BPMN2NS = Namespace.getNamespace("http://schema.omg.org/spec/BPMN/2.0");
    Document doc = new SAXBuilder().build(file);

    BPMNProcess<Element> proc = new BPMNProcess<Element>();
    Element procElem = doc.getRootElement().getChild("process", BPMN2NS);
    if (procElem == null) {
      BPMN2NS = Namespace.getNamespace("http://www.omg.org/spec/BPMN/20100524/MODEL");
      procElem = doc.getRootElement().getChild("process", BPMN2NS);
    }

    initProcess(proc, procElem, BPMN2NS);
    return proc;
  }

  protected static void initProcess(BPMNProcess<Element> proc, Element procElem, Namespace BPMN2NS) {
    Map<String, Integer> nodes = new HashMap<String, Integer>();
    List<Element> edges = new LinkedList<Element>();

    for (Object obj : procElem.getChildren())
      if (obj instanceof Element) {
        Element elem = (Element) obj;
        String id = elem.getAttributeValue("id");
        if (id == null || id.isEmpty())
          System.out.println("oops");
        String name = elem.getAttributeValue("name");
        if (elem.getName().endsWith("ask") || elem.getName().endsWith("vent")) {
          // if (elem.getName().equals("startEvent"))
          // name = "_input_";
          // if (elem.getName().equals("endEvent") && (name == null || name.isEmpty()))
          // name = "_output_";
          if (elem.getName().endsWith("ask")) {
            String property = "";
            // List properties = elem.getContent(x -> x instanceof Element && ((Element)x).getName() == "property");
            List<Element> properties = (List<Element>)elem.getContent().stream().filter(x -> x != null && x instanceof Element && ((Element)x).getName() == "property").collect(Collectors.toList());
            if(properties.size() > 0){
              property = ((Element)properties.get(0)).getName();
              nodes.put(id, proc.addTask(name, id, elem));
            }
            for (Object obj2 : elem.getContent()) {
              if (obj2 instanceof Element) {
                Element elem2 = (Element) obj2;
                if (elem2.getName() == "dataInputAssociation") {
                  // nodes.put(id, proc.addTask(name, id, elem4));
                  // for (Object obj3 : elem2.getContent()) {
                  // if(obj3 instanceof Element){
                  // Element elem3 = (Element) obj3;
                  // if(elem3.getName() == "sourceRef"){
                  // for (Object obj4 : elem3.getContent()) {
                  // if(obj4 instanceof Text){
                  // Text elem4 = (Text) obj4;
                  // // proc.
                  // nodes.put(id, proc.addTask(name, id, elem4.getValue()));
                  // }
                  // }
                  // }
                  // System.out.println("qwe");
                  // }
                  // }
                }
              }
            }
          }

          // .for
          // nodes.put(id, proc.addTask(name, id, elem));
        } else if (elem.getName().equals("exclusiveGateway") || elem.getName().equals("eventBasedGateway")) {
          nodes.put(id, proc.addXORGateway(name, id, elem));
        } else if (elem.getName().equals("parallelGateway")) {
          nodes.put(id, proc.addANDGateway(name, id, elem));
        } else if (elem.getName().equals("inclusiveGateway")) {
          nodes.put(id, proc.addORGateway(name, id, elem));
        } else if (elem.getName().equals("sequenceFlow")) {
          edges.add(elem);
        } else if (elem.getName().equals("dataInputAssociation")) {
          System.out.println("assoc");
          // edges.add(elem);
        }

      }

    for (Element edge : edges) {
      Integer src = nodes.get(edge.getAttributeValue("sourceRef"));
      Integer tgt = nodes.get(edge.getAttributeValue("targetRef"));
      if (src != null && tgt != null) {
        proc.addEdge(src, tgt, edge);
      } else {
        System.out.println(edge.getAttributeValue("sourceRef"));
        System.out.println(edge.getAttributeValue("targetRef"));
        throw new RuntimeException("Malformed graph");
      }
    }
  }

}
