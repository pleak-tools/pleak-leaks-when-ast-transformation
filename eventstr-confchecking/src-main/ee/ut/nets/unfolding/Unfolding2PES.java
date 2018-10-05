package ee.ut.nets.unfolding;

import hub.top.uma.DNode;
import hub.top.uma.DNodeBP;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.BitSet;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Queue;
import java.util.Set;

import org.jbpt.utils.IOUtils;
import org.processmining.framework.util.Pair;

import com.google.common.collect.BiMap;
import com.google.common.collect.HashBiMap;
import com.google.common.collect.HashMultimap;
import com.google.common.collect.Multimap;

import ee.ut.eventstr.PrimeEventStructure;
import ee.ut.graph.cliques.CCliqueFinder;
import ee.ut.graph.transitivity.BitsetDAGTransitivity;
import ee.ut.graph.transitivity.MatrixBasedTransitivity;

public class Unfolding2PES {
	private BPstructBPSys sys;
	private BPstructBP bp;
	private Set<String> visibleLabels;
	private List<String> labels;
	private Map<DNode, Integer> orderedVisibleEventMap;
	private List<DNode> orderedVisibleEvents;
	private PrimeEventStructure<Integer> pes;
	private Set<Integer> cutoffEvents;
	private Map<Integer, Integer> cutoffCorrespondingMap;
	private Set<Integer> invisibleEvents;
	private Set<Integer> terminalEvents;
	private Map<Integer, BiMap<Integer, Integer>> isomorphism;
	

	public Unfolding2PES(BPstructBPSys sys, BPstructBP bp, Set<String> originalVisibleLabels) {
		this.sys = sys;
		this.bp = bp;
		this.orderedVisibleEventMap = new HashMap<>();
		this.orderedVisibleEvents = new ArrayList<>();
		this.cutoffCorrespondingMap = new HashMap<>();
		this.cutoffEvents = new HashSet<>();
		this.invisibleEvents = new HashSet<>();
		this.terminalEvents = new HashSet<>();

		this.labels = new ArrayList<>();
		
		this.visibleLabels = new HashSet<>(originalVisibleLabels);
		
		int numberOfEvents = bp.getBranchingProcess().allEvents.size();
		int numberOfConditions = bp.getBranchingProcess().allConditions.size();
		int fullSize = numberOfConditions + numberOfEvents + 3;
		boolean[][] matrix = new boolean[fullSize][fullSize];

		Map<DNode, Integer> localMap = new HashMap<>();
		Set<DNode> visibleEvents = new HashSet<>();
		Set<DNode> cutoffDNodes = new HashSet<>();
		Map<Integer, DNode> invisibleSinks = new HashMap<>();
		Set<DNode> visibleSinks = new HashSet<>();
		
		int localId = 0;
		for (DNode node: bp.getBranchingProcess().allEvents) {
			localMap.put(node, localId++);

			boolean atLeastOneTerminal = false;
			boolean atLeastOneNonTerminal = false;

			for (DNode cond: node.post) {
				if (sys.isTerminal(cond))
					atLeastOneTerminal = true;
				else
					atLeastOneNonTerminal = true;
			}
			boolean sinkEvent = atLeastOneTerminal & !atLeastOneNonTerminal;


			if (originalVisibleLabels.contains(sys.properNames[node.id]) || node.isCutOff || sinkEvent) {
				visibleEvents.add(node);
				orderedVisibleEvents.add(node);
				if (!originalVisibleLabels.contains(sys.properNames[node.id]) && sinkEvent)
					invisibleSinks.put(orderedVisibleEventMap.size(), node);

				orderedVisibleEventMap.put(node, orderedVisibleEventMap.size());
				labels.add(sys.properNames[node.id]);
			}
			
			if (sinkEvent && node.isCutOff)
				visibleSinks.add(node);
			
			if (node.isCutOff)
				cutoffDNodes.add(node);
		}
				
		for (DNode cutoff: cutoffDNodes) {
			DNode corresponding = bp.getCutOffEquivalentEvent().get(cutoff);
			if (!visibleEvents.contains(corresponding)) {
				visibleEvents.add(corresponding);
				orderedVisibleEvents.add(corresponding);
				orderedVisibleEventMap.put(corresponding, orderedVisibleEventMap.size());
				labels.add(sys.properNames[corresponding.id]);				
			}
			if (!visibleSinks.contains(cutoff)) {
				cutoffCorrespondingMap.put(orderedVisibleEventMap.get(cutoff), orderedVisibleEventMap.get(corresponding));
				System.out.printf("Cutoff: %s, Corresponding: %s\n", sys.properNames[cutoff.id], sys.properNames[corresponding.id]);
			}
		}
		
		localId = numberOfEvents;
		for (DNode node: bp.getBranchingProcess().allConditions)
			localMap.put(node, localId++);
		
		for (DNode node: bp.getBranchingProcess().allEvents) {
			for (DNode pred: node.pre)
				matrix[localMap.get(pred)][localMap.get(node)] = true;
			for (DNode succ: node.post)
				matrix[localMap.get(node)][localMap.get(succ)] = true;
		}

		MatrixBasedTransitivity.transitiveClosure(matrix);
		
		for (DNode node: bp.getBranchingProcess().allEvents) {
			if (visibleEvents.contains(node)) continue;
			Arrays.fill(matrix[localMap.get(node)], false);
		}
		MatrixBasedTransitivity.transitiveReduction(matrix, numberOfEvents);
		
		Multimap<Integer, Integer> adj = HashMultimap.create();
		Map<Integer, BitSet> preConcurrency = new HashMap<>();
		Multimap<Integer, Integer> preConcurrencyPrime = HashMultimap.create();
		for (DNode n1: visibleEvents) {
			int _n1 = orderedVisibleEventMap.get(n1);
			preConcurrency.put(_n1, new BitSet());
			for (DNode n2: visibleEvents)
				if (!n1.equals(n2)) {
					int _n2 = orderedVisibleEventMap.get(n2);					
					if (matrix[localMap.get(n1)][localMap.get(n2)]) {
						adj.put(_n1, _n2);
					} else if (//_n1 < _n2 && 
							bp.areConcurrent_struct(n1, n2) == DNodeBP.REL_CO) {
						if (!preConcurrency.containsKey(_n2))
							preConcurrency.put(_n2, new BitSet());
						preConcurrency.get(_n1).set(_n2);
						preConcurrency.get(_n2).set(_n1);
						preConcurrencyPrime.put(_n1, _n2);
						preConcurrencyPrime.put(_n2, _n1);
					}
				}
		}
		
		Set<Integer> sources = new HashSet<>(adj.keySet());
		sources.removeAll(adj.values());
		Set<Integer> sinks = new HashSet<>(adj.values());
		sinks.removeAll(adj.keySet());
		
		// =================
		// TODO: Partition the set of sources and the set of sinks into cosets
		// =================
		int finalSize = visibleEvents.size();
		int artificialStartEvent = finalSize;
		
		
		for (Integer source: sources) {
			adj.put(finalSize++, source);
			labels.add("_0_");
		}
		
		Set<Integer> visibleSinkEvents = new HashSet<>();
		for (Integer sink: sinks) {
			DNode node = orderedVisibleEvents.get(sink);
			for (DNode cond: node.post)
				if (sys.isTerminal(cond))
					visibleSinkEvents.add(sink);
		}

		Set<Set<Integer>> sinkCoSets = new CCliqueFinder(visibleSinkEvents, preConcurrencyPrime, HashMultimap.create(), preConcurrencyPrime).getAllMaximalCliques();
		
		for (Set<Integer> coset: sinkCoSets) {
			Set<Integer> intersection = new HashSet<>(invisibleSinks.keySet());
			intersection.retainAll(coset);
			if (intersection.isEmpty()) {
				terminalEvents.add(finalSize);
				for (Integer sink: coset)
					adj.put(sink, finalSize);
				finalSize++;
				labels.add("_1_");
			} else {
				if (coset.size() > 1)
					throw new RuntimeException("Something wrong with this model: ");
				labels.set(coset.iterator().next(), "_1_");
			}
		}
		sinks = terminalEvents;

		Pair<BitSet[], BitSet[]> pair = BitsetDAGTransitivity.transitivityDAG(adj, labels.size(), Collections.singleton(artificialStartEvent));
		BitSet[] causality = pair.getFirst();
		BitSet[] dcausality = pair.getSecond();
		BitSet[] invcausality = new BitSet[finalSize];
		BitSet[] conflict = new BitSet[finalSize];
		BitSet[] concurrency = new BitSet[finalSize];

		for (int i = 0; i < finalSize; i++) {
			invcausality[i] = new BitSet();
			conflict[i] = new BitSet();
			if (preConcurrency.containsKey(i))
				concurrency[i] = preConcurrency.get(i);
			else
				concurrency[i] = new BitSet();
		}
		
		for (int i = 0; i < finalSize; i++)
			for (int j = causality[i].nextSetBit(0); j >= 0; j = causality[i].nextSetBit(j + 1))
				invcausality[j].set(i);

		for (int i = 0; i < finalSize; i++) {
			BitSet union = (BitSet) causality[i].clone();
			union.or(invcausality[i]);
			union.or(concurrency[i]);
			union.set(i); // Remove IDENTITY
			conflict[i].flip(0, finalSize);
			conflict[i].xor(union);
		}
		
		pes = new PrimeEventStructure<Integer>(labels, causality, dcausality, invcausality,
						concurrency, conflict, Arrays.asList(artificialStartEvent), new ArrayList<>(sinks));
		
		
		for (DNode cutoff: cutoffDNodes) {
			if (!visibleSinks.contains(cutoff))
				cutoffEvents.add(orderedVisibleEventMap.get(cutoff));
		}
		
		visibleLabels.add("_1_");
		visibleLabels.add("_0_");

		for (int e = 0; e < labels.size(); e++)
			if (!visibleLabels.contains(labels.get(e)))
				invisibleEvents.add(e);				
		
//		IOUtils.toFile("pes.dot", pes.toDot());
				
		isomorphism = new HashMap<>();
		Map<DNode, BiMap<DNode, DNode>> _isomorphism = computeIsomorphism();
		for (DNode _cutoff: _isomorphism.keySet()) {
			Integer cutoff = orderedVisibleEventMap.get(_cutoff);
			BiMap<Integer, Integer> bimap = HashBiMap.create();
			for (Entry<DNode, DNode> entry: _isomorphism.get(_cutoff).entrySet()) {
				Integer e = orderedVisibleEventMap.get(entry.getKey());
				Integer ep = orderedVisibleEventMap.get(entry.getValue());
				if (e != null && ep != null && !e.equals(ep))
					bimap.put(e, ep);
			}
			isomorphism.put(cutoff, bimap);
		}
		System.out.println(">> " + isomorphism);
	}

	public Map<Integer, BiMap<Integer, Integer>> getIsomorphism() {
		return isomorphism;
	}
	
	private Map<DNode, BiMap<DNode, DNode>> computeIsomorphism() {
		Queue<Pair<DNode, DNode>> q = new LinkedList<>();
		Map<DNode, BiMap<DNode, DNode>> _isomorphism = new HashMap<>();

		for (Entry<DNode,DNode> entry: bp.getElementary_ccPair().entrySet()) {
			DNode cutoff = entry.getKey();
			DNode corr = entry.getValue();
			Map<Short, DNode> mmap = new HashMap<>();
			BiMap<DNode, DNode> bimap = HashBiMap.create();
			
			DNode[] cutoffCUT = 
					bp.getBranchingProcess().getPrimeCut(cutoff, false, false);
			DNode[] corrCUT = 
					bp.getBranchingProcess().getPrimeCut(corr, false, false);
			
			for (DNode b: cutoffCUT)
				mmap.put(b.id, b);
			for (DNode bp: corrCUT) {
				DNode b = mmap.get(bp.id);
				q.offer(new Pair<>(b, bp));
				bimap.put(b, bp);
			}
			
			System.out.println("Current bimap: " + bimap);
						
			while (!q.isEmpty()) {
				Pair<DNode, DNode> pair = q.poll();
				
				System.out.println(pair);
				
				if (pair.getFirst().post == null || pair.getSecond().post == null)
					continue;
				
//				boolean processed = true;
				for (DNode yp: pair.getSecond().post) {
					boolean enabled = true;
					for (DNode zp: yp.pre)
						if (!bimap.containsValue(zp)) {
							enabled = false;
							break;
						}
					if (enabled) {
						for (DNode y: pair.getFirst().post) {
							if (y.id == yp.id) {
								enabled = true;
								for (DNode z: y.pre)
									if (!bimap.containsKey(z)) {
										enabled = false;
										break;
									}
								if (enabled) {
									q.offer(new Pair<>(y, yp));
									bimap.put(y, yp);
								}
							}
						}
					}
				}
//				if (!processed)
//					q.offer(pair);
			}
			_isomorphism.put(cutoff, bimap);
		}
		return _isomorphism;
	}

	public Set<Integer> getInvisibleEvents() {
		return invisibleEvents;
	}

	public PrimeEventStructure<Integer> getPES() {
		return pes;
	}

	public Set<Integer> getCutoffEvents() {
		return cutoffEvents;
	}
	
	public boolean isVisible(int event) {
		DNode dnode = orderedVisibleEvents.get(event);
		return visibleLabels.contains(sys.properNames[dnode.id]);
	}


	public Integer getCorrespondingEvent(int ev) {
		return cutoffCorrespondingMap.get(ev);
	}
	
	public Set<Integer> getTerminalEvents() {
		return terminalEvents;
	}
}
