package ee.ut.eventstr.confcheck.test;

import hub.top.petrinet.PetriNet;
import hub.top.petrinet.Place;

import com.google.common.collect.Lists;
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
import ee.ut.nets.unfolding.Unfolder_PetriNet;
import ee.ut.nets.unfolding.BPstructBP.MODE;

public class Unfolder {
	
	public static void main(String[] args) {
    String id = args[0];
    GsonBuilder builder = new GsonBuilder();
    builder.setPrettyPrinting();
    Gson gson = builder.create();
    String json = "";
    
    try {
			File file = new File("target/" + id + ".json");
			FileReader fileReader = new FileReader(file);
			StringBuffer stringBuffer = new StringBuffer();
			int numCharsRead;
			char[] charArray = new char[1024];
			while ((numCharsRead = fileReader.read(charArray)) > 0) {
				stringBuffer.append(charArray, 0, numCharsRead);
			}
      fileReader.close();
      json = stringBuffer.toString();
		} catch (IOException e) {
			e.printStackTrace();
		}

    PetriNode[] petri = gson.fromJson(json, PetriNode[].class);
    PetriNet net = PetriConverter.Convert(petri);
		
		IOUtils.toFile("net.dot", net.toDot());

    // Unfolding petri net
		Unfolder_PetriNet unfolder = new Unfolder_PetriNet(net, MODE.ONEUNFOLDING);
		unfolder.computeUnfolding();
    PetriNet bp = unfolder.getUnfoldingAsPetriNet();
    
    Set<Place> terminals = bp.getPlaces().stream().filter(x -> 
    {
      return x.getOutgoing().size() == 0;
    }).collect(Collectors.toSet());
    
    // Removing residual parts
    terminals.forEach(x -> {
      String name = x.getName();
      Set<Place> sameNameWithOutgoing = bp.getPlaces().stream().filter(y -> y.getName() == name && y.id != x.id && y.getOutgoing().size() > 0).collect(Collectors.toSet());
      if(sameNameWithOutgoing.size() > 0) {
        NetTraverse.RemoveResiduals(bp, x);
      }
    });

    ArrayList<ArrayList<String>> runs = new ArrayList<ArrayList<String>>();
    Set<Place> starts = bp.getPlaces().stream().filter(x -> x.getIncoming().size() == 0 && x.getName().contains("StartEvent")).collect(Collectors.toSet());
    
    // Building runs
    starts.forEach(x -> {
      Map<String, Boolean> e = new HashMap<String, Boolean>();
      bp.getTransitions().stream().forEach(y -> {
        e.put(y.getUniqueIdentifier(), false);
      });
      
      Integer remainingPrev = Integer.MAX_VALUE;
      Integer remainingNew = Integer.MAX_VALUE;

      do {
        remainingPrev = remainingNew;
        bp.getPlaces().stream().forEach(y -> {
          e.put(y.getUniqueIdentifier(), false);
        });

        ArrayList<String> run = new ArrayList<String>();
        NetTraverse.BuildRun(bp, x, run, e);
        runs.add(run);

        remainingNew = e.entrySet().stream().filter(y -> y.getValue() == false).collect(Collectors.toList()).size();
      }
      while(remainingNew < remainingPrev && remainingNew > 0);
    });
    
    List<String[]> list = runs.stream().map(x -> {
      String[] subs = Lists.reverse(x).toArray(new String[x.size()]);
      return subs;
    }).collect(Collectors.toList());
    
    String[][] result = list.toArray(new String[list.size()][]);
    IOUtils.toFile(id + "_result.json", gson.toJson(result));
	}
}