class WorkoutPlan < ApplicationRecord
  belongs_to :user
  belongs_to :mentor
  has_many :chats, dependent: :destroy
end
