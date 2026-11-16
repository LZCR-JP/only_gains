class CreateMentors < ActiveRecord::Migration[8.1]
  def change
    create_table :mentors do |t|
      t.string :name
      t.text :personality
      t.text :system_prompt
      t.string :avatar_url

      t.timestamps
    end
  end
end
