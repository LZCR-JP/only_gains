class AddTrainingScheduleToWorkoutPlans < ActiveRecord::Migration[8.1]
  def change
    add_column :workout_plans,
               :training_schedule,
               :string,
               array: true,
               default: [],
               null: false
  end
end
