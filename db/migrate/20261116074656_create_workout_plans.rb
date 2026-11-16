class CreateWorkoutPlans < ActiveRecord::Migration[8.1]
  def change
    create_table :workout_plans do |t|
      t.references :user, null: false, foreign_key: true
      t.references :mentor, null: false, foreign_key: true
      t.string :title
      t.string :goal
      t.string :fitness_level
      t.string :equipment
      t.integer :training_days
      t.integer :duration_minutes
      t.text :description
      t.text :system_prompt

      t.timestamps
    end
  end
end
