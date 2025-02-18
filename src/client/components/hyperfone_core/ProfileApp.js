/*
 * Core Profile App
 * Built-in profile management for Hyperfy
 */

import { css } from '@firebolt-dev/css'
import { useState } from 'react'

export function ProfileApp({ 
  playerName, setPlayerName,
  playerBio, setPlayerBio,
  playerPicture, setPlayerPicture,
  playerGender, setPlayerGender,
  bloodType, setBloodType,
  playerStats, setPlayerStats,
  isEditingProfile, setIsEditingProfile,
  saveProfile
}) {
  // Calculate total points for profile stats
  const calculateTotalPoints = (stats) => {
    if (!stats) return 0
    return Object.values(stats).reduce((sum, value) => sum + parseInt(value || 0), 0)
  }

  return (
    <div css={css`
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 10px;
    `}>
      <div css={css`
        display: flex;
        justify-content: space-between;
        align-items: center;
      `}>
        <h3 css={css`
          margin: 0;
          color: white;
          font-size: 18px;
        `}>
          Player Profile
        </h3>
        <button
          css={css`
            background: none;
            border: none;
            color: #551bf9;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 5px;
            border-radius: 4px;
            transition: all 0.15s ease-out;
            &:hover {
              background: rgba(85, 27, 249, 0.1);
            }
          `}
          onClick={() => setIsEditingProfile(!isEditingProfile)}
        >
          {isEditingProfile ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Profile Content */}
      <div css={css`
        display: flex;
        gap: 20px;
        align-items: flex-start;
      `}>
        {/* Profile Picture Column */}
        <div css={css`
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          width: 120px;
        `}>
          <div css={css`
            width: 100px;
            height: 100px;
            border-radius: 50%;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.2);
            border: 2px solid rgba(85, 27, 249, 0.3);
          `}>
            <img 
              src={playerPicture} 
              alt="Profile"
              css={css`
                width: 100%;
                height: 100%;
                object-fit: cover;
              `}
            />
          </div>

          {isEditingProfile && (
            <>
              <input
                type="text"
                value={playerPicture}
                onChange={(e) => setPlayerPicture(e.target.value)}
                placeholder="Enter image URL"
                css={css`
                  width: 100%;
                  background: rgba(0, 0, 0, 0.2);
                  border: none;
                  border-radius: 8px;
                  padding: 4px 8px;
                  color: white;
                  font-size: 10px;
                  text-align: center;
                  &:focus {
                    outline: none;
                    border-color: #551bf9;
                  }
                `}
              />
              <button
                css={css`
                  background: none;
                  border: none;
                  color: #551bf9;
                  font-size: 12px;
                  cursor: pointer;
                  padding: 4px;
                  &:hover {
                    text-decoration: underline;
                  }
                `}
                onClick={() => setPlayerPicture('https://hyperfy.xyz/logo-icon.svg')}
              >
                Reset to Default
              </button>
            </>
          )}
        </div>

        {/* Profile Info */}
        <div css={css`
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 15px;
        `}>
          {/* Display Name */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 5px;
          `}>
            <label css={css`
              color: rgba(255, 255, 255, 0.6);
              font-size: 12px;
            `}>
              Display Name
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your display name"
                css={css`
                  background: rgba(0, 0, 0, 0.2);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 8px;
                  padding: 12px;
                  color: white;
                  font-size: 14px;
                  &:focus {
                    outline: none;
                    border-color: #551bf9;
                  }
                `}
              />
            ) : (
              <div css={css`
                color: white;
                font-size: 16px;
                background: rgba(0, 0, 0, 0.2);
                padding: 12px;
                border-radius: 8px;
              `}>
                {playerName || 'Anonymous Player'}
              </div>
            )}
          </div>

          {/* Gender Selection */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 5px;
          `}>
            <label css={css`
              color: rgba(255, 255, 255, 0.6);
              font-size: 12px;
            `}>
              Gender
            </label>
            {isEditingProfile ? (
              <div css={css`
                display: flex;
                gap: 10px;
              `}>
                {['male', 'female'].map(gender => (
                  <button
                    key={gender}
                    css={css`
                      flex: 1;
                      padding: 8px;
                      background: ${playerGender === gender ? 'rgba(85, 27, 249, 0.3)' : 'rgba(0, 0, 0, 0.2)'};
                      border: 1px solid ${playerGender === gender ? '#551bf9' : 'rgba(255, 255, 255, 0.1)'};
                      border-radius: 8px;
                      color: white;
                      cursor: pointer;
                      text-transform: capitalize;
                      &:hover {
                        background: rgba(85, 27, 249, 0.2);
                      }
                    `}
                    onClick={() => setPlayerGender(gender)}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            ) : (
              <div css={css`
                color: white;
                font-size: 16px;
                background: rgba(0, 0, 0, 0.2);
                padding: 12px;
                border-radius: 8px;
                text-transform: capitalize;
              `}>
                {playerGender || 'Not Specified'}
              </div>
            )}
          </div>

          {/* Blood Type */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 5px;
          `}>
            <label css={css`
              color: rgba(255, 255, 255, 0.6);
              font-size: 12px;
            `}>
              Blood Type
            </label>
            {isEditingProfile ? (
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                css={css`
                  background: rgba(0, 0, 0, 0.2);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 8px;
                  padding: 12px;
                  color: white;
                  font-size: 14px;
                  cursor: pointer;
                  &:focus {
                    outline: none;
                    border-color: #551bf9;
                  }
                `}
              >
                <option value="">Select Blood Type</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            ) : (
              <div css={css`
                color: white;
                font-size: 16px;
                background: rgba(0, 0, 0, 0.2);
                padding: 12px;
                border-radius: 8px;
              `}>
                {bloodType || 'Not Specified'}
              </div>
            )}
          </div>

          {/* Bio */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 5px;
          `}>
            <label css={css`
              color: rgba(255, 255, 255, 0.6);
              font-size: 12px;
            `}>
              Bio
            </label>
            {isEditingProfile ? (
              <textarea
                value={playerBio}
                onChange={(e) => setPlayerBio(e.target.value)}
                placeholder="Tell us about yourself..."
                css={css`
                  background: rgba(0, 0, 0, 0.2);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 8px;
                  padding: 12px;
                  color: white;
                  font-size: 14px;
                  min-height: 100px;
                  resize: vertical;
                  &:focus {
                    outline: none;
                    border-color: #551bf9;
                  }
                `}
              />
            ) : (
              <div css={css`
                color: white;
                font-size: 14px;
                background: rgba(0, 0, 0, 0.2);
                padding: 12px;
                border-radius: 8px;
                white-space: pre-wrap;
                min-height: 100px;
              `}>
                {playerBio || 'No bio provided'}
              </div>
            )}
          </div>

          {/* Stats */}
          <div css={css`
            display: flex;
            flex-direction: column;
            gap: 5px;
          `}>
            <label css={css`
              color: rgba(255, 255, 255, 0.6);
              font-size: 12px;
            `}>
              Stats ({calculateTotalPoints(playerStats)} Points)
            </label>
            <div css={css`
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
              gap: 10px;
            `}>
              {['strength', 'agility', 'intelligence', 'charisma'].map(stat => (
                <div
                  key={stat}
                  css={css`
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                  `}
                >
                  <label css={css`
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 10px;
                    text-transform: capitalize;
                  `}>
                    {stat}
                  </label>
                  {isEditingProfile ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={playerStats?.[stat] || 0}
                      onChange={(e) => {
                        const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                        setPlayerStats({
                          ...playerStats,
                          [stat]: value
                        })
                      }}
                      css={css`
                        background: rgba(0, 0, 0, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                        width: 100%;
                        &:focus {
                          outline: none;
                          border-color: #551bf9;
                        }
                      `}
                    />
                  ) : (
                    <div css={css`
                      background: rgba(0, 0, 0, 0.2);
                      border-radius: 4px;
                      padding: 4px 8px;
                      color: white;
                      font-size: 12px;
                    `}>
                      {playerStats?.[stat] || 0}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {isEditingProfile && (
        <button
          onClick={saveProfile}
          css={css`
            background: #551bf9;
            border: none;
            color: white;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
            margin-top: 20px;
            &:hover {
              opacity: 0.9;
              transform: translateY(-1px);
              box-shadow: 0 5px 15px rgba(85, 27, 249, 0.2);
            }
          `}
        >
          Save Changes
        </button>
      )}
    </div>
  )
} 