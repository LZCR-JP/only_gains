class WorkoutChangeProposal < ApplicationRecord
  belongs_to :message

  validates :status, inclusion: {
    in: %w[pending accepted rejected stale]
  }

  validates :proposal, :workout_snapshot,
            :plan_updated_at, presence: true

  def accept!
    workout_plan = message.chat.workout_plan

    workout_plan.with_lock do
      with_lock do
        if status == "pending"
          if workout_plan.generated_workout != workout_snapshot ||
             workout_plan.updated_at != plan_updated_at

            update!(status: "stale")
          else
            updated_workout = workout_snapshot.deep_dup

            day = updated_workout.fetch("days").find do |item|
              item["name"] == proposal.fetch("day_name")
            end

            index = day.fetch("exercises").find_index do |exercise|
              exercise["name"] == proposal.fetch("original_exercise")
            end

            raise "Exercise not found" if index.nil?

            day["exercises"][index] = proposal.fetch("replacement")

            workout_plan.update!(
              generated_workout: updated_workout
            )

            update!(status: "accepted")
          end
        end

        status
      end
    end
  end

  def reject!
    with_lock do
      update!(status: "rejected") if status == "pending"
      status
    end
  end
end
