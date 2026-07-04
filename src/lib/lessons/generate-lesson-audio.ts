export {
  approveContentAudio as approveLessonAudio,
  approveContentAudio,
  formatAudioReviewTitle,
  generateContentAudio as generateLessonAudio,
  generateContentAudio,
  getPublicAudioUrl,
  getPublicLessonAudioUrl,
  rejectContentAudio as rejectLessonAudio,
  rejectContentAudio,
  updateContentAudioScript as updateLessonAudioScript,
  updateContentAudioScript,
} from "@/lib/audio/generate-audio";

export { LESSON_AUDIO_BUCKET } from "@/lib/lessons/lesson-audio-storage";
export {
  lessonAudioStoragePath,
  publicUrlForLessonAudioPath,
} from "@/lib/lessons/lesson-audio-storage";
