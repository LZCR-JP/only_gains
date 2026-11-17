class CreateWorkoutChangeProposals < ActiveRecord::Migration[8.1]
  def change
    create_table :workout_change_proposals do |t|
      t.references :message, null: false,
                   foreign_key: true, index: { unique: true }

      t.jsonb :proposal, null: false
      t.jsonb :workout_snapshot, null: false
      t.datetime :plan_updated_at, null: false
      t.string :status, null: false, default: "pending"

      t.timestamps
    end
  end
end
