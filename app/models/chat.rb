class Chat < ApplicationRecord
  belongs_to :workout_plan
  has_many :messages, dependent: :destroy
end
