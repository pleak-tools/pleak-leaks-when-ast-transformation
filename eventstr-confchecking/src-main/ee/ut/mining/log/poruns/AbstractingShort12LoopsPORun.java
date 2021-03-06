package ee.ut.mining.log.poruns;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Stack;
import java.util.TreeSet;

import org.deckfour.xes.model.XTrace;

import com.google.common.collect.Multimap;

import ee.ut.mining.log.ConcurrencyRelations;

public class AbstractingShort12LoopsPORun extends PORun {
	
	public AbstractingShort12LoopsPORun(ConcurrencyRelations alphaRelations, XTrace trace) {
		super(alphaRelations, trace);
		Multimap<Integer, Integer> successors = asSuccessorsList();
		Multimap<Integer, Integer> predecessors = asPredecessorsList();
		Stack<Integer> open = new Stack<>();
		Set<Integer> visited = new HashSet<>();
		open.push(getSource());
		
		List<Integer> list = null;
		List<List<Integer>> lists = new ArrayList<>();
		Set<Integer> verticesToAdjust = new TreeSet<>();
		int state = 0;
		int nextstate = 0;
		while (!open.isEmpty()) {
			Integer curr = open.pop();
			visited.add(curr);
			String label = labels.get(curr);
			System.out.printf("working with '%s'(%d)\n", label, curr);
			if (label == null) {
				System.err.println("found an event without a label (null value instead)");
				continue;
			}
			
			System.out.printf("State %d, label %s(%d)\n", state, label, curr);
			
			switch (state) {
			case 0:
				if (label.equals("D")) {
					list = new ArrayList<>();
					list.add(curr);
					nextstate = 1;
				} else if (label.equals("B")) {
					list = new ArrayList<>();
					list.add(curr);	
					nextstate = 2;
				} else if (label.equals("C")) {
					list = new ArrayList<>();
					list.add(curr);	
					nextstate = 3;
				} else
					nextstate = 0;
				break;
			case 1:
				if (label.equals("D")) {
					list.add(curr);
					nextstate = 1;
				} else {
					if (list != null && list.size() > 1) {
						lists.add(list);
						verticesToAdjust.addAll(list);
//						verticesToAdjust.remove(list.get(list.size()-1));
					}
					if (label.equals("B")) {
						list = new ArrayList<>();
						list.add(curr);	
						nextstate = 2;
					} else if (label.equals("C")) {
						list = new ArrayList<>();
						list.add(curr);	
						nextstate = 3;
					} else
						nextstate = 0;
				}
				break;
			case 2:
				if (label.equals("B")) {
					list.add(curr);
					nextstate = 2;
				} else {
					if (list != null && list.size() > 1) {
						lists.add(list);
						verticesToAdjust.addAll(list);
//						verticesToAdjust.remove(list.get(list.size()-1));
					}
					if (label.equals("D")) {
						list = new ArrayList<>();
						list.add(curr);	
						nextstate = 1;
					} else if (label.equals("C")) {
						list.add(curr);	
						nextstate = 4;
					} else {
						nextstate = 0;
					}
				}
				break;
			case 3:
				if (label.equals("C")) {
					list.add(curr);
					nextstate = 3;
				} else {
					if (list != null && list.size() > 1) {
						lists.add(list);
						verticesToAdjust.addAll(list);
//						verticesToAdjust.remove(list.get(list.size()-1));
					}
					if (label.equals("D")) {
						list = new ArrayList<>();
						list.add(curr);	
						nextstate = 1;
					} else if (label.equals("B")) {
						list.add(curr);	
						nextstate = 4;
					} else {
						nextstate = 0;
					}
				}
				break;
			case 4:
				if (label.equals("B") || label.equals("C")) {
					list.add(curr);
					nextstate = 4;
				} else {
					if (list != null && list.size() > 1) {
						lists.add(list);
						verticesToAdjust.addAll(list);
//						verticesToAdjust.remove(list.get(list.size()-1));
					}
					if (label.equals("D")) {
						list = new ArrayList<>();
						list.add(curr);	
						nextstate = 1;
					} else {
						nextstate = 0;
					}
				}
				break;
			}
			
			state = nextstate;
			
			for (Integer succ: successors.get(curr))
				if (!visited.contains(succ) && !open.contains(succ) && visited.containsAll(predecessors.get(succ)))
					open.push(succ);
		}
		
		if (!lists.isEmpty())
			System.out.println("Loops: " + lists);
		System.out.println("To adjust: " + verticesToAdjust);
				
		for (List<Integer> seq: lists) {
			int first = vertexIndexMap.get(seq.get(0));
			int last = vertexIndexMap.get(seq.get(seq.size()-1));
			for (int ev = 0; ev < adjmatrix.length; ev++)
				adjmatrix[first][ev] = adjmatrix[last][ev];
//			adjmatrix[vertexIndexMap.get(first)][vertexIndexMap.get(last)] = true;
			verticesToAdjust.remove(seq.get(0));
//			labels.put(first, labels.get(first) + "_LStart");
//			labels.put(last, labels.get(last) + "_LEnd");
//			System.out.printf("%d -> %d\n", first, last);
		}
		System.out.println("To remove: " + verticesToAdjust);
		
		for (Integer vertex: verticesToAdjust) {
			int index = vertexIndexMap.get(vertex);
			Arrays.fill(adjmatrix[index], false);
		}

		for (Integer v: verticesToAdjust)
			labels.remove(v);
	}
}
