class CreateWorkoutLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :workout_logs do |t|
      t.references :workout_plan, null: false, foreign_key: true
      t.string :day_name, null: false
      t.datetime :completed_at, null: false
      t.text :notes

      t.timestamps
    end
  end
end
