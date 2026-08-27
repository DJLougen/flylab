# FlyLab source verification

Last checked: 2026-08-26

FlyLab's scientific links and pinned data products were checked against publisher, DOI, repository, and dataset metadata. No scientific URL in the application or submission copy was found to be dead or to resolve to the wrong work.

| Source | Verification result |
|---|---|
| Bidaye et al., *Science* (2014) | DOI, Crossref, and PubMed identify the cited article. The publisher blocks automated page reads; this is an access restriction, not a dead DOI. |
| Sen et al., *Current Biology* (2017) | DOI, Elsevier landing metadata, and PubMed identify the cited article. Direct automated article reads may be blocked by the publisher. |
| Feng et al., *Nature Communications* (2020) | DOI resolves to the intended article; license metadata records CC BY 4.0. |
| von Reyn et al., *Nature Neuroscience* (2014) | DOI resolves to the intended primary article. The publisher record identifies targeted GF activation/silencing, recording, and the short-mode escape figures; publisher copyright applies. |
| King & Wyman, *Journal of Neurocytology* (1980) | DOI and PubMed identify the primary anatomy paper describing the GF contacts to the jump-muscle motor axon and interneuron relay to flight-muscle motor neurons. |
| Allen & Murphey, *European Journal of Neuroscience* (2007) | DOI and journal metadata identify the electrophysiology paper on the mixed GF–TTMn synapse. FlyLab uses it only for the electrical and cholinergic chemical components of that synapse, not for the PSI/DLM or neuromuscular branches. |
| Azevedo et al., *Nature* (2024) | DOI and PubMed identify the adult-female FANC connectome paper and its leg/wing escape analysis. FlyLab bundles no FANC nodes, edges, figures, or article text. |
| Cande et al., *eLife* (2018) | DOI resolves to the intended article; publisher rights metadata records CC BY. |
| Cande Dryad dataset, version 1 | DOI and Dryad/DataCite metadata agree on the released dataset and CC0-1.0 terms. |
| Bates et al., *Nature* / BANC (2026) | DOI resolves to the intended article; the article is CC BY 4.0. |
| BANC Dataverse, version 3.0 | DOI and Dataverse APIs identify the released dataset and CC BY 4.0 terms. FlyLab's two cited Feather inputs are unrestricted and match the recorded file IDs and checksums. The broader deposit has mixed file-level access and should not be described as entirely open. |
| BANC released-data documentation | The repository page documents the `banc_888` release and L2 SWC products used by FlyLab. |
| Six BANC SWC reconstructions | All six public source objects downloaded successfully; their byte sizes and SHA-256 checksums match FlyLab's morphology manifest. |
| FlyEM MANC `manc:v1.2.1` | Janelia's release page identifies the cited version and CC BY terms. |
| FlyGym v2.1.0 | The release tag exists, resolves to FlyLab's pinned commit, and the repository license is Apache-2.0. FlyLab cites it as an embodiment reference and does not claim to execute it. |

Publisher access restrictions are kept distinct from scientific provenance. An automated `403` from a publisher is not treated as proof of a broken DOI when authoritative DOI and bibliographic metadata independently confirm the destination.

This review verifies link identity, access description, the pinned assets used by the MDN→LBL40 slice, and the claim-level sources for the GF leg/wing path. It is not a dependency-by-dependency software-license audit.

## Claim-level support map

- `E-MDN-ACTIVATION-001`: Bidaye abstract (PMID 24700860) and Sen Figure 1/Movie S1 support assay-specific activation effects.
- `E-MDN-SILENCING-005`: Bidaye abstract supports the reported barrier-evoked silencing impairment.
- `E-MDN-LATERALITY-006`: Sen Figure 4A–C/Movie S4 supports recruitment/laterality context.
- `E-FENG-LBL40-008` and `E-FENG-LUL130-009`: Feng Figures 5/7 and 6/7 support the respective motor-context claims.
- `E-DN-SCREEN-002`: Cande's Introduction screen-design paragraph supplies the line/neuron/type counts; its Discussion limitations paragraph supplies the male-only/solitary scope; Dryad v1 identifies the released catalog dataset.
- `E-BANC-PATH-003`: Dataverse file 13918810 and its recorded SHA-256 identify four exact MDN→LBL40 rows totaling 153 v3-predicted synaptic links after the postsynapse-size ≥10-voxel filter; the BANC article supplies dataset/specimen context and distinguishes that future-work product from the paper's v2 ≥5 analysis product.
- `E-BANC-MDN-INVENTORY-007`: Dataverse file 14033740 and its recorded SHA-256 identify the four exact proofread MDN rows and sides.
- `E-FLYLAB-MODEL-004`: the local model card is the `method_definition`; the FlyGym paper and v2.1.0 release are `embodiment_reference` records only.
- `E-GF-CAUSAL-010`: von Reyn Figures 2–4 and Supplementary Video 3 support assay-scoped GF necessity/sufficiency and spike-timing control for short-mode escape.
- `E-GF-PATH-011`: King & Wyman's primary thoracic-pathway anatomy supports the GF→TTMn jump-muscle branch and GF→interneuron→DLM motor-neuron flight-muscle branch; Allen & Murphey's primary electrophysiology supports the electrical and cholinergic chemical components of the mixed GF–TTMn synapse.
- `E-FANC-ESCAPE-012`: Azevedo et al., “Coordination of legs and wings during take-off” and Figure 6 support connectome-derived structural hypotheses for GF-coupled escape outputs. It remains `connectome_inferred`, is a separate specimen from BANC, and supplies no executable weight.

The callable contract enforces this distinction. A draft hypothesis requires a discovered `perturbation_effect` record matching both the proposed perturbation and behavior. Structural, inventory, and motor-context records are supplemental; model/catalog context cannot be promoted into causal support. A `flylab.experiment-evidence-bundle.v3` carries the selected supporting and model-method closures separately. A `flylab.mission-evidence-bundle.v3` additionally preserves the discovery decision, considered/rejected alternatives, exclusions, and coverage gaps. Caller titles, notes, and mission goals remain `untrusted_annotation` administrative metadata rather than scientific evidence.
