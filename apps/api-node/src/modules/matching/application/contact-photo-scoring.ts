import { defaultMatchingConfig, scoreMatchCandidates, type MatchCandidate } from "../domain/matching.engine.js";

// A photo has no trustworthy loss location/time: those signals get no weight.
export function scoreContactPhoto(target: MatchCandidate, observed: { title: string; description: string; categoryId: string | null; visualAttributes: string[]; visibleText: string[] }) {
  const photo: MatchCandidate = { ...target, id: "contact-photo", type: "FOUND", userId: "photo-uploader", title: observed.title,
    text: `${observed.title} ${observed.description}`, categoryId: observed.categoryId, parentCategoryId: null,
    imageText: observed.visualAttributes.join(" "), ocrText: observed.visibleText.join(" "),
    areaId: null, buildingId: null, roomText: null, customLocation: null, lostFoundAt: null };
  const result = scoreMatchCandidates(photo,[target],{ ...defaultMatchingConfig, weights: { text: .55, category: .15, image: .25, ocr: .05, location: 0, time: 0 } })[0]!;
  return result.totalScore;
}
