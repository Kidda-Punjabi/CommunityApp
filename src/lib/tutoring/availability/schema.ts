type PostgrestLikeError = {
  code?: string;
  message?: string;
};

export function isAvailabilitySchemaMissingError(error: PostgrestLikeError): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    message.includes("tutor_availability_settings") ||
    message.includes("tutor_availability_windows") ||
    message.includes("tutor_one_to_one_bookings") ||
    message.includes("tutor_one_to_one_booking_credits")
  );
}
