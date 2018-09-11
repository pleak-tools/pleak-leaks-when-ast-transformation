package ee.ut.eventstr.confcheck.test;

import hub.top.petrinet.PetriNet;
import hub.top.petrinet.Place;

import com.google.gson.Gson; 
import com.google.gson.GsonBuilder;
import com.google.gwt.dev.util.collect.HashMap;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.io.FileReader;
import java.io.IOException;

import org.jbpt.utils.IOUtils;
import org.junit.Test;
import ee.ut.nets.unfolding.Unfolder_PetriNet;
import ee.ut.nets.unfolding.BPstructBP.MODE;

public class ExpandedPomsetPrefixTest2 {
	@Test
	public void test() throws Exception {
    GsonBuilder builder = new GsonBuilder();
    builder.setPrettyPrinting();
    Gson gson = builder.create();
    String json = "";

    try {
			File file = new File("models/elementary/petri.json");
			FileReader fileReader = new FileReader(file);
			StringBuffer stringBuffer = new StringBuffer();
			int numCharsRead;
			char[] charArray = new char[1024];
			while ((numCharsRead = fileReader.read(charArray)) > 0) {
				stringBuffer.append(charArray, 0, numCharsRead);
			}
      fileReader.close();
      json = stringBuffer.toString();

			// System.out.println("Contents of file:");
			System.out.println(stringBuffer.toString());
		} catch (IOException e) {
			e.printStackTrace();
		}

    PetriNode[] petri = gson.fromJson(json, PetriNode[].class);
    PetriNet net = PetriConverter.Convert(petri);

		// BPMNProcess<Element> model = BPMN2Reader.parse(new File("models/elementary/cycle.bpmn"));
		// Petrifier<Element> petrifier = new Petrifier<Element>(model);
		// PetriNet net = petrifier.petrify(model.getSources().iterator().next(), model.getSinks().iterator().next());
		// System.out.println(model.getLabels());
//		
//		Set<String> labels = new HashSet<String>();
//		for (Integer node: model.getVisibleNodes())
//			labels.add(model.getName(node));
		
		IOUtils.toFile("net.dot", net.toDot());

		Unfolder_PetriNet unfolder = new Unfolder_PetriNet(net, MODE.ONEUNFOLDING);
		unfolder.computeUnfolding();
    PetriNet bp = unfolder.getUnfoldingAsPetriNet();
    
    Set<Place> terminals = bp.getPlaces().stream().filter(x -> x.getOutgoing().size() == 0).collect(Collectors.toSet());
    
    terminals.forEach(x -> {
      String name = x.getName();
      Set<Place> sameNameWithOutgoing = bp.getPlaces().stream().filter(y -> y.getName() == name && y.id != x.id && y.getOutgoing().size() > 0).collect(Collectors.toSet());
      if(sameNameWithOutgoing.size() > 0) {
        NetTraverse.RemoveResiduals(bp, x);
      }
    });

    Set<Place> prunedTerminals = bp.getPlaces().stream().filter(x -> x.getOutgoing().size() == 0).collect(Collectors.toSet());
    ArrayList<ArrayList<String>> runs = new ArrayList<ArrayList<String>>();
    
    prunedTerminals.forEach(x -> {
      Map<String, Integer> e = new HashMap<String, Integer>();
      bp.getTransitions().stream().forEach(y -> e.put(y.getUniqueIdentifier(), 0));
      bp.getPlaces().stream().forEach(y -> e.put(y.getUniqueIdentifier(), 0));

      ArrayList<String> run = new ArrayList<String>();
      NetTraverse.BuildRun(bp, x, run, e);
      runs.add(run);
    });

    
    List<String[]> list = runs.stream().map(x -> {
      String[] news = x.toArray(new String[x.size()]);
      return news;
    }).collect(Collectors.toList());
    String[][] qwe = list.toArray(new String[list.size()][]);

    
		IOUtils.toFile("bp.dot", bp.toDot());
//		Unfolding2PES pes = new Unfolding2PES(unfolder.getSys(), unfolder.getBP(), labels);
//		NewUnfoldingPESSemantics<Integer> pessem = new NewUnfoldingPESSemantics<Integer>(pes.getPES(), pes);
//		IOUtils.toFile("bpmnpes.dot", pessem.toDot());
//		
//		IOUtils.toFile("expprefix.dot", new ExpandedPomsetPrefix<Integer>(pessem).toDot());
	}
}
