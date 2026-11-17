class AddGeneratedWorkoutToWorkoutPlans < ActiveRecord::Migration[8.1]
  def change
    add_column :workout_plans, :generated_workout, :jsonb
  end
end
